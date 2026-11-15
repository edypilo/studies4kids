import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { extractText, getDocumentProxy, renderPageAsImage } from 'unpdf';
import { DATA_DIR, getDb, type MaterialKind, type MaterialStatus } from './db';

export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 20;
export const MAX_TEXT_CHARS = 500_000;

type FileType = { kind: 'pdf' | 'image'; mime: string; ext: string };

/** Identifica el archivo por su contenido, no por el nombre ni por lo que diga el navegador. */
export function sniff(buf: Buffer): FileType | null {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return { kind: 'pdf', mime: 'application/pdf', ext: 'pdf' };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { kind: 'image', mime: 'image/jpeg', ext: 'jpg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { kind: 'image', mime: 'image/png', ext: 'png' };
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP')
    return { kind: 'image', mime: 'image/webp', ext: 'webp' };
  return null;
}

async function readPdf(buf: Buffer): Promise<{ text: string; pages: number }> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  return { text: text.replace(/[ \t]+\n/g, '\n').trim(), pages: totalPages };
}

/** Guarda un archivo subido y, si es un PDF con texto, lo extrae. Devuelve un error legible o null. */
export async function saveUpload(topicId: number, file: File): Promise<string | null> {
  const name = file.name.slice(0, 150) || 'Archivo';
  if (file.size > MAX_FILE_BYTES) return `${name}: pesa más de 25 MB.`;
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf);
  if (!type) return `${name}: formato no admitido (solo PDF, JPG, PNG o WebP).`;

  const relative = `${topicId}/${randomUUID()}.${type.ext}`;
  const absolute = path.join(UPLOAD_DIR, relative);
  await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
  await fs.promises.writeFile(absolute, buf);

  let kind: MaterialKind = type.kind;
  let status: MaterialStatus = 'pending_ai';
  let content: string | null = null;
  let pages: number | null = null;
  if (type.kind === 'pdf') {
    try {
      const pdf = await readPdf(buf);
      pages = pdf.pages;
      // Un PDF escaneado apenas trae texto: menos de 40 caracteres por página lo delata.
      if (pdf.text.length >= Math.max(40, pdf.pages * 40)) {
        content = pdf.text.slice(0, MAX_TEXT_CHARS);
        status = 'text';
      }
    } catch {
      status = 'error';
    }
  }

  getDb()
    .prepare(
      `INSERT INTO materials (topic_id, kind, name, file, mime, size, pages, content, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(topicId, kind, name, relative, type.mime, buf.length, pages, content, status);
  return null;
}

export const MAX_SCANNED_PAGES = 40;

/**
 * Convierte las páginas de un PDF escaneado en imágenes JPEG dentro de una carpeta temporal,
 * para que la IA pueda leerlas. Quien llama debe borrar `dir` al terminar.
 */
export async function renderPdfPages(file: string, dir: string): Promise<{ pages: string[]; total: number }> {
  const canvas = await import('@napi-rs/canvas');
  const data = new Uint8Array(await fs.promises.readFile(path.join(UPLOAD_DIR, file)));
  // pdf.js se queda con el búfer que recibe: cada llamada necesita su propia copia.
  const total = (await getDocumentProxy(data.slice())).numPages;
  const pages: string[] = [];
  for (let n = 1; n <= Math.min(total, MAX_SCANNED_PAGES); n++) {
    const png = await renderPageAsImage(data.slice(), n, { canvasImport: async () => canvas, width: 1400 });
    const image = await canvas.loadImage(Buffer.from(png));
    const surface = canvas.createCanvas(image.width, image.height);
    surface.getContext('2d').drawImage(image, 0, 0);
    const target = path.join(dir, `pagina${n}.jpg`);
    await fs.promises.writeFile(target, surface.toBuffer('image/jpeg', 80));
    pages.push(target);
  }
  return { pages, total };
}

export function filesOfTopic(topicId: number): string[] {
  const rows = getDb().prepare('SELECT file FROM materials WHERE topic_id = ? AND file IS NOT NULL').all(topicId);
  return (rows as { file: string }[]).map((r) => r.file);
}

export function filesOfSubject(subjectId: number): string[] {
  const rows = getDb()
    .prepare(
      `SELECT m.file FROM materials m JOIN topics t ON t.id = m.topic_id
        WHERE t.subject_id = ? AND m.file IS NOT NULL`,
    )
    .all(subjectId);
  return (rows as { file: string }[]).map((r) => r.file);
}

export function filesOfProfile(profileId: number): string[] {
  const rows = getDb()
    .prepare(
      `SELECT m.file FROM materials m
         JOIN topics t ON t.id = m.topic_id
         JOIN subjects s ON s.id = t.subject_id
         JOIN courses c ON c.id = s.course_id
        WHERE c.profile_id = ? AND m.file IS NOT NULL`,
    )
    .all(profileId);
  return (rows as { file: string }[]).map((r) => r.file);
}

/** Borra del disco los archivos indicados (rutas relativas a la carpeta de subidas). */
export async function removeFiles(files: string[]) {
  await Promise.all(files.map((f) => fs.promises.rm(path.join(UPLOAD_DIR, f), { force: true })));
}
