import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDb } from './db';

/**
 * Capa de IA con proveedor intercambiable:
 *  - codex:  Codex CLI con la sesión de ChatGPT del servidor (`codex login`). Usa el plan de ChatGPT.
 *  - openai: clave de la API de OpenAI (pago por uso).
 * El resto de la app solo conoce generateJson().
 */
export type AiProvider = 'none' | 'codex' | 'openai';

export type AiSettings = {
  provider: AiProvider;
  openaiKey: string;
  openaiModel: string;
  codexModel: string;
};

export const DEFAULT_OPENAI_MODEL = 'gpt-5.5';
const TIMEOUT_MS = 10 * 60 * 1000;

export function getSetting(key: string): string {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? '';
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}

export function getAiSettings(): AiSettings {
  const provider = getSetting('ai_provider');
  return {
    provider: provider === 'codex' || provider === 'openai' ? provider : 'none',
    openaiKey: getSetting('openai_key'),
    openaiModel: getSetting('openai_model') || DEFAULT_OPENAI_MODEL,
    codexModel: getSetting('codex_model'),
  };
}

export function aiReady(s: AiSettings = getAiSettings()): boolean {
  return s.provider === 'codex' || (s.provider === 'openai' && s.openaiKey !== '');
}

export type AiImage = { path: string; mime: string };

export type AiRequest = {
  /** Papel e instrucciones fijas. */
  instructions: string;
  /** Contenido variable (material del alumno, etc.). */
  input: string;
  images?: AiImage[];
  schemaName: string;
  /** JSON Schema estricto: todos los campos en required y additionalProperties: false. */
  schema: Record<string, unknown>;
};

export async function generateJson<T>(req: AiRequest): Promise<T> {
  const settings = getAiSettings();
  if (settings.provider === 'codex') return viaCodex<T>(req, settings);
  if (settings.provider === 'openai') return viaOpenAi<T>(req, settings);
  throw new Error('La IA no está configurada. Hay que conectarla desde el panel de padres.');
}

// ───────────────────────── Codex CLI ─────────────────────────

/** Cómo lanzar Codex. En Windows npm instala un .cmd; se ejecuta su script con Node para no depender del shell. */
function codexCommand(): { cmd: string; pre: string[] } {
  const custom = process.env.CODEX_BIN;
  if (custom) return custom.endsWith('.js') ? { cmd: process.execPath, pre: [custom] } : { cmd: custom, pre: [] };
  if (process.platform === 'win32' && process.env.APPDATA) {
    const script = path.join(process.env.APPDATA, 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    if (fs.existsSync(script)) return { cmd: process.execPath, pre: [script] };
  }
  return { cmd: 'codex', pre: [] };
}

type RunResult = { code: number | null; stdout: string; stderr: string };

function runCodex(args: string[], opts: { cwd?: string; input?: string; timeoutMs?: number } = {}): Promise<RunResult> {
  const { cmd, pre } = codexCommand();
  return new Promise((resolve, reject) => {
    const child = spawn(/* turbopackIgnore: true */ cmd, [...pre, ...args], { cwd: opts.cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('La IA ha tardado demasiado y se ha cancelado.'));
    }, opts.timeoutMs ?? TIMEOUT_MS);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr = (stderr + d).slice(-4000)));
    child.on('error', (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(e.code === 'ENOENT' ? new Error('Codex no está instalado en el servidor.') : e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(opts.input ?? '');
  });
}

/** Estado de Codex en el servidor, para el panel de padres. */
export async function codexStatus(): Promise<{ installed: boolean; loggedIn: boolean; detail: string }> {
  try {
    const version = await runCodex(['--version'], { timeoutMs: 15_000 });
    if (version.code !== 0) return { installed: false, loggedIn: false, detail: 'Codex no responde.' };
    const login = await runCodex(['login', 'status'], { timeoutMs: 15_000 });
    const text = (login.stdout + login.stderr).trim().split('\n')[0] ?? '';
    return { installed: true, loggedIn: login.code === 0, detail: `${version.stdout.trim()} · ${text}` };
  } catch (e) {
    return { installed: false, loggedIn: false, detail: e instanceof Error ? e.message : 'Codex no disponible.' };
  }
}

async function viaCodex<T>(req: AiRequest, settings: AiSettings): Promise<T> {
  // Carpeta vacía y sandbox de solo lectura: Codex es un agente y el material subido no es de fiar.
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 's4k-'));
  try {
    await fs.promises.writeFile(path.join(dir, 'schema.json'), JSON.stringify(req.schema));
    // --ignore-user-config: no depende de la configuración personal de Codex del equipo (la sesión sí se usa).
    const args = ['exec', '-', '--skip-git-repo-check', '--ephemeral', '--ignore-user-config', '--sandbox', 'read-only'];
    args.push('--output-schema', 'schema.json', '-o', 'out.json');
    if (settings.codexModel) args.push('-m', settings.codexModel);
    for (const [i, image] of (req.images ?? []).entries()) {
      const name = `imagen${i + 1}${path.extname(image.path)}`;
      await fs.promises.copyFile(image.path, path.join(dir, name));
      args.push('-i', name);
    }
    const prompt =
      `${req.instructions}\n\nNo ejecutes comandos ni leas archivos: responde solo con el JSON pedido.\n\n${req.input}`;
    const result = await runCodex(args, { cwd: dir, input: prompt });
    if (result.code !== 0) {
      const tail = result.stderr.trim().split('\n').slice(-3).join(' ').slice(0, 400);
      throw new Error(`Codex devolvió un error. ${tail}`);
    }
    const out = await fs.promises.readFile(path.join(dir, 'out.json'), 'utf8');
    return JSON.parse(out) as T;
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ───────────────────────── API de OpenAI ─────────────────────────

type ResponsesPayload = {
  error?: { message?: string };
  output?: { content?: { type: string; text?: string }[] }[];
};

async function viaOpenAi<T>(req: AiRequest, settings: AiSettings): Promise<T> {
  if (!settings.openaiKey) throw new Error('Falta la clave de la API de OpenAI.');
  const content: Record<string, unknown>[] = [{ type: 'input_text', text: req.input }];
  for (const image of req.images ?? []) {
    const data = await fs.promises.readFile(image.path);
    content.push({ type: 'input_image', image_url: `data:${image.mime};base64,${data.toString('base64')}` });
  }
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${settings.openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.openaiModel,
      instructions: req.instructions,
      input: [{ role: 'user', content }],
      text: { format: { type: 'json_schema', name: req.schemaName, schema: req.schema, strict: true } },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const payload = (await res.json().catch(() => ({}))) as ResponsesPayload;
  if (!res.ok) throw new Error(`OpenAI respondió ${res.status}: ${payload.error?.message ?? 'error desconocido'}`);
  const text = (payload.output ?? [])
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === 'output_text')
    .map((c) => c.text ?? '')
    .join('');
  if (!text) throw new Error('OpenAI no devolvió contenido.');
  return JSON.parse(text) as T;
}
