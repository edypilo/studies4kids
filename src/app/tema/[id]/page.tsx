import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmButton } from '@/components/ConfirmButton';
import { UploadForm } from '@/components/UploadForm';
import { AutoRefresh } from '@/components/AutoRefresh';
import { addTextMaterial, deleteMaterial, generateNotes } from '@/lib/actions';
import { aiReady } from '@/lib/ai';
import { canAccess, requireProfile } from '@/lib/auth';
import { endOfToday, formatScore } from '@/lib/topics';
import { getDb, type KeyTerm, type Material, type NoteSection, type Stage, type TopicNotes } from '@/lib/db';

export const dynamic = 'force-dynamic';

type TopicRow = {
  id: number;
  title: string;
  subject_id: number;
  subject: string;
  course_id: number;
  course: string;
  stage: Stage;
  active: number;
  profile_id: number;
};

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

function statusOf(m: Material): { label: string; ready: boolean } {
  if (m.status === 'text') {
    return { label: `Texto listo · ${(m.content?.length ?? 0).toLocaleString('es-ES')} caracteres`, ready: true };
  }
  if (m.status === 'error') return { label: 'No se pudo leer el PDF', ready: false };
  if (m.status === 'reading') return { label: 'La IA la está leyendo…', ready: false };
  return {
    label: m.kind === 'image' ? 'Foto: se leerá al crear el resumen' : 'PDF escaneado: se leerá al crear el resumen',
    ready: false,
  };
}

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireProfile();
  const { id } = await params;
  const db = getDb();
  const topic = db
    .prepare(
      `SELECT t.id, t.title, t.subject_id, s.name AS subject, c.id AS course_id, c.name AS course,
              c.stage, c.active, c.profile_id
         FROM topics t
         JOIN subjects s ON s.id = t.subject_id
         JOIN courses c ON c.id = s.course_id
        WHERE t.id = ?`,
    )
    .get(Number(id)) as TopicRow | undefined;
  if (!topic || !canAccess(me, topic.profile_id)) notFound();
  const back = topic.active ? '/inicio' : `/inicio?curso=${topic.course_id}`;
  const materials = db.prepare('SELECT * FROM materials WHERE topic_id = ? ORDER BY id').all(topic.id) as Material[];
  const notes = db.prepare('SELECT * FROM topic_notes WHERE topic_id = ?').get(topic.id) as TopicNotes | undefined;
  const sections = notes?.sections ? (JSON.parse(notes.sections) as NoteSection[]) : [];
  const keyTerms = notes?.key_terms ? (JSON.parse(notes.key_terms) as KeyTerm[]) : [];
  const cardStats = db
    .prepare('SELECT COUNT(*) AS total, COALESCE(SUM(due_at <= ?), 0) AS due FROM flashcards WHERE topic_id = ?')
    .get(endOfToday(), topic.id) as { total: number; due: number };
  const testStats = db
    .prepare(
      `SELECT COUNT(*) AS total,
              (SELECT MAX(a.score) FROM quiz_attempts a JOIN quizzes q2 ON q2.id = a.quiz_id
                WHERE q2.topic_id = ? AND a.status = 'done') AS best
         FROM quizzes WHERE topic_id = ? AND status = 'ready'`,
    )
    .get(topic.id, topic.id) as { total: number; best: number | null };
  const generating = notes?.status === 'generating';
  const hasNotes = Boolean(notes?.intro);
  const ready = aiReady();
  const usable = materials.some((m) => m.status === 'text' || m.status === 'pending_ai');

  return (
    <div className={`stage-${topic.stage}`}>
      <div className="crumbs">
        <Link href={back}>{topic.course}</Link> › <Link href={`/asignatura/${topic.subject_id}`}>{topic.subject}</Link> ›
      </div>
      <h1>{topic.title}</h1>

      <h2>Material</h2>
      {materials.length === 0 ? (
        <div className="empty">Aún no hay material. Sube el PDF o las fotos del libro y de tus apuntes.</div>
      ) : (
        <div className="list">
          {materials.map((m) => {
            const status = statusOf(m);
            return (
              <div key={m.id} className="material">
                <div className="material-head">
                  {m.kind === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="thumb" src={`/archivo/${m.id}`} alt="" loading="lazy" />
                  ) : (
                    <span className="thumb icon">{m.kind === 'pdf' ? 'PDF' : 'TXT'}</span>
                  )}
                  <div className="material-info">
                    {m.file ? (
                      <a className="material-name" href={`/archivo/${m.id}`} target="_blank" rel="noreferrer">
                        {m.name}
                      </a>
                    ) : (
                      <span className="material-name">{m.name}</span>
                    )}
                    <span className="muted">
                      {sizeLabel(m.size)}
                      {m.pages ? ` · ${m.pages} ${m.pages === 1 ? 'página' : 'páginas'}` : ''}
                    </span>
                    <span className={status.ready ? 'badge' : 'badge off'}>{status.label}</span>
                  </div>
                  <form action={deleteMaterial}>
                    <input type="hidden" name="materialId" value={m.id} />
                    <ConfirmButton message={`¿Borrar "${m.name}"? No se puede deshacer.`}>Borrar</ConfirmButton>
                  </form>
                </div>
                {m.content && (
                  <details>
                    <summary className="muted">Ver el texto</summary>
                    <pre className="material-text">{m.content}</pre>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}

      <h2>Subir archivos</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        PDF o fotos (JPG, PNG, WebP), hasta 25 MB cada uno. Desde el móvil puedes hacer la foto directamente.
      </p>
      <UploadForm topicId={topic.id} />

      <details className="card" style={{ marginTop: 14 }}>
        <summary>O pega un texto</summary>
        <form action={addTextMaterial} className="paste">
          <input type="hidden" name="topicId" value={topic.id} />
          <input name="name" placeholder="Título (opcional)" aria-label="Título del texto" maxLength={150} />
          <textarea name="content" rows={8} placeholder="Pega aquí tus apuntes…" aria-label="Texto" required />
          <button className="btn">Guardar texto</button>
        </form>
      </details>

      <h2>Resumen</h2>
      {generating && <AutoRefresh />}
      {generating ? (
        <div className="banner" role="status">
          <strong>La IA está trabajando.</strong> {notes?.step} Puede tardar un par de minutos; no hace falta que
          esperes en esta página.
        </div>
      ) : !ready ? (
        <div className="empty">La IA todavía no está conectada. Pídeselo a tus padres.</div>
      ) : !usable ? (
        <div className="empty">Sube primero algo de material con texto o fotos para poder crear el resumen.</div>
      ) : (
        <form action={generateNotes} className="row">
          <input type="hidden" name="topicId" value={topic.id} />
          <button className="btn">{hasNotes ? 'Volver a crear el resumen' : 'Crear resumen'}</button>
          <span className="muted">
            {hasNotes ? 'Úsalo si has añadido material nuevo.' : 'Lee tus fotos y resume todo el material del tema.'}
          </span>
        </form>
      )}
      {!generating && notes?.error && (
        <p className={notes.status === 'error' ? 'error' : 'muted'} style={{ marginTop: 10 }}>
          {notes.status === 'error' ? `No se pudo crear el resumen: ${notes.error}` : notes.error}
        </p>
      )}
      {hasNotes && (
        <article className="card notes">
          <p className="notes-intro">{notes?.intro}</p>
          {sections.map((s) => (
            <section key={s.title}>
              <h3>{s.title}</h3>
              <ul>
                {s.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          ))}
        </article>
      )}

      {keyTerms.length > 0 && (
        <>
          <h2>Términos clave</h2>
          <dl className="terms">
            {keyTerms.map((k) => (
              <div key={k.term} className="term">
                <dt>{k.term}</dt>
                <dd>{k.definition}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <h2>Estudiar</h2>
      <div className="grid">
        <Link href={`/tema/${topic.id}/tarjetas`} className="card mode-card">
          <strong>Tarjetas</strong>
          <span className="muted">
            {cardStats.total === 0
              ? 'Crea tarjetas de pregunta y respuesta para memorizar el tema.'
              : `${cardStats.total === 1 ? '1 tarjeta' : `${cardStats.total} tarjetas`} · ${cardStats.due} para hoy`}
          </span>
        </Link>
        <Link href={`/tema/${topic.id}/explicar`} className="card mode-card">
          <strong>Explícalo</strong>
          <span className="muted">Cuenta el tema con tus palabras y descubre qué dominas y qué te falta.</span>
        </Link>
        <Link href={`/tema/${topic.id}/tutor`} className="card mode-card">
          <strong>Tutor</strong>
          <span className="muted">Pregunta tus dudas del tema a un tutor que te ayuda a pensar.</span>
        </Link>
        <Link href={`/tema/${topic.id}/tests`} className="card mode-card">
          <strong>Tests</strong>
          <span className="muted">
            {testStats.total === 0
              ? 'Quiz rápido y simulacros de examen con corrección.'
              : `${testStats.total === 1 ? '1 test' : `${testStats.total} tests`}${
                  testStats.best !== null ? ` · mejor nota ${formatScore(testStats.best)}` : ''
                }`}
          </span>
        </Link>
      </div>
    </div>
  );
}
