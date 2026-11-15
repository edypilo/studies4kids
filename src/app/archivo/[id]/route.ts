import fs from 'node:fs';
import path from 'node:path';
import { canAccess, getCurrentProfile, materialOwner } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { UPLOAD_DIR } from '@/lib/materials';

/** Sirve un archivo subido solo a su dueño o a los padres. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentProfile();
  if (!me) return new Response('No autorizado', { status: 401 });
  const id = Number((await params).id);
  const owner = materialOwner(id);
  if (owner === null || !canAccess(me, owner)) return new Response('No encontrado', { status: 404 });

  const row = getDb().prepare('SELECT file, mime, name FROM materials WHERE id = ?').get(id) as
    | { file: string | null; mime: string | null; name: string }
    | undefined;
  if (!row?.file || !row.mime) return new Response('No encontrado', { status: 404 });

  let data: Buffer;
  try {
    data = await fs.promises.readFile(path.join(UPLOAD_DIR, row.file));
  } catch {
    return new Response('No encontrado', { status: 404 });
  }
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': row.mime,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
