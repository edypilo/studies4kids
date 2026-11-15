import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoRefresh } from '@/components/AutoRefresh';
import { ExplainForm } from '@/components/ExplainForm';
import { aiReady } from '@/lib/ai';
import { requireProfile } from '@/lib/auth';
import { getDb, type Explanation, type ExplanationResult } from '@/lib/db';
import { EXPLAIN_PASS } from '@/lib/exams';
import { formatScore, getTopicFor, shortDate } from '@/lib/topics';

export const dynamic = 'force-dynamic';

function Block({ title, items, className }: { title: string; items: string[]; className: string }) {
  if (items.length === 0) return null;
  return (
    <div className={`feedback ${className}`}>
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** "Explícalo con tus palabras": el alumno cuenta el tema y la IA le dice qué domina y qué le falta. */
export default async function ExplainPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireProfile();
  const topic = getTopicFor(me, Number((await params).id));
  if (!topic) notFound();
  const db = getDb();
  const attempts = db
    .prepare('SELECT * FROM explanations WHERE topic_id = ? ORDER BY id DESC LIMIT 10')
    .all(topic.id) as Explanation[];
  const hasMaterial = Boolean(
    db.prepare("SELECT 1 FROM materials WHERE topic_id = ? AND status IN ('text', 'pending_ai') LIMIT 1").get(topic.id),
  );
  const latest = attempts[0];
  const grading = latest?.status === 'grading';
  const result = latest?.result ? (JSON.parse(latest.result) as ExplanationResult) : null;

  return (
    <div className={`stage-${topic.stage}`}>
      <div className="crumbs">
        <Link href={`/asignatura/${topic.subject_id}`}>{topic.subject}</Link> ›{' '}
        <Link href={`/tema/${topic.id}`}>{topic.title}</Link> ›
      </div>
      <h1>Explícalo con tus palabras</h1>
      <p className="muted">
        Sin mirar los apuntes, cuenta todo lo que sepas del tema. Explicar algo es la mejor forma de saber si de verdad
        lo entiendes. La IA te dirá qué dominas y qué te falta.
      </p>

      {grading && <AutoRefresh />}
      {grading && (
        <div className="banner" role="status">
          <strong>La IA está leyendo tu explicación.</strong> Tarda alrededor de un minuto; el resultado aparecerá aquí
          solo.
        </div>
      )}
      {latest?.status === 'error' && <p className="error">No se pudo revisar: {latest.error} Vuelve a enviarla.</p>}

      {latest?.status === 'done' && latest.score !== null && result && (
        <>
          <div className={`score ${latest.score >= EXPLAIN_PASS ? 'pass' : 'fail'}`}>
            <span className="score-number">{formatScore(latest.score)}</span>
            <span>
              sobre 10 ·{' '}
              {latest.score >= 9
                ? '¡Lo dominas!'
                : latest.score >= EXPLAIN_PASS
                  ? 'Lo entiendes bien. Mira lo que te falta.'
                  : 'Todavía hay huecos. Repasa y vuelve a intentarlo.'}
            </span>
          </div>
          <Block title="Lo que has explicado bien" items={result.understood} className="good" />
          <Block title="Lo que te ha faltado" items={result.missing} className="gap" />
          <Block title="Lo que no es correcto" items={result.mistakes} className="bad" />
          {result.tip && <p className="hint">Consejo: {result.tip}</p>}
          <details className="card" style={{ marginTop: 12 }}>
            <summary>Ver lo que escribiste</summary>
            <p className="review-answer">{latest.text}</p>
          </details>
        </>
      )}

      <h2>{attempts.length === 0 ? 'Tu explicación' : 'Inténtalo otra vez'}</h2>
      {!aiReady() ? (
        <div className="empty">La IA todavía no está conectada. Pídeselo a tus padres.</div>
      ) : !hasMaterial ? (
        <div className="empty">
          Sube primero material al tema para que la IA pueda comparar. <Link href={`/tema/${topic.id}`}>Ir al tema →</Link>
        </div>
      ) : (
        <ExplainForm topicId={topic.id} disabled={grading} />
      )}

      {attempts.length > 1 && (
        <>
          <h2>Intentos anteriores</h2>
          <div className="list">
            {attempts.slice(1).map((a) => (
              <div key={a.id} className="list-item">
                <span>{shortDate(a.created_at)}</span>
                <span className="badge off">
                  {a.status === 'done' && a.score !== null ? `${formatScore(a.score)} sobre 10` : 'Sin nota'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
