import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoRefresh } from '@/components/AutoRefresh';
import { ConfirmButton } from '@/components/ConfirmButton';
import { createQuiz, deleteQuiz } from '@/lib/actions';
import { aiReady } from '@/lib/ai';
import { requireProfile } from '@/lib/auth';
import { getDb, type Question, type Quiz } from '@/lib/db';
import { formatScore, getTopicFor, shortDate } from '@/lib/topics';

export const dynamic = 'force-dynamic';

type Row = Quiz & { attempts: number; best: number | null; last_attempt: number | null };

export default async function TestsPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireProfile();
  const topic = getTopicFor(me, Number((await params).id));
  if (!topic) notFound();
  const db = getDb();
  const quizzes = db
    .prepare(
      `SELECT q.*,
              (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id = q.id) AS attempts,
              (SELECT MAX(a.score) FROM quiz_attempts a WHERE a.quiz_id = q.id AND a.status = 'done') AS best,
              (SELECT MAX(a.id) FROM quiz_attempts a WHERE a.quiz_id = q.id) AS last_attempt
         FROM quizzes q WHERE q.topic_id = ? ORDER BY q.id DESC`,
    )
    .all(topic.id) as Row[];
  const hasMaterial = Boolean(
    db.prepare("SELECT 1 FROM materials WHERE topic_id = ? AND status IN ('text', 'pending_ai') LIMIT 1").get(topic.id),
  );
  const generating = quizzes.some((q) => q.status === 'generating');

  return (
    <div className={`stage-${topic.stage}`}>
      <div className="crumbs">
        <Link href={`/asignatura/${topic.subject_id}`}>{topic.subject}</Link> ›{' '}
        <Link href={`/tema/${topic.id}`}>{topic.title}</Link> ›
      </div>
      <h1>Tests</h1>
      <p className="muted">Ponte a prueba con preguntas sacadas de tu material.</p>
      {generating && <AutoRefresh />}

      {!aiReady() ? (
        <div className="empty" style={{ marginTop: 16 }}>
          La IA todavía no está conectada. Pídeselo a tus padres.
        </div>
      ) : !hasMaterial ? (
        <div className="empty" style={{ marginTop: 16 }}>
          Sube primero material al tema para que la IA pueda preparar preguntas.{' '}
          <Link href={`/tema/${topic.id}`}>Ir al tema →</Link>
        </div>
      ) : (
        <div className="grid" style={{ marginTop: 16 }}>
          <form action={createQuiz} className="card mode-card">
            <input type="hidden" name="topicId" value={topic.id} />
            <input type="hidden" name="kind" value="quiz" />
            <strong>Quiz rápido</strong>
            <span className="muted">Tipo test, con pistas y la explicación de cada respuesta al momento.</span>
            <button className="btn" disabled={generating}>
              Nuevo quiz
            </button>
          </form>
          <form action={createQuiz} className="card mode-card">
            <input type="hidden" name="topicId" value={topic.id} />
            <input type="hidden" name="kind" value="exam" />
            <strong>Simulacro de examen</strong>
            <span className="muted">Con tiempo y preguntas para escribir, sin ayudas. Se corrige al entregar.</span>
            <button className="btn" disabled={generating}>
              Nuevo simulacro
            </button>
          </form>
        </div>
      )}

      {quizzes.length > 0 && (
        <>
          <h2>Tus tests</h2>
          <div className="list">
            {quizzes.map((q) => {
              const count = q.questions ? (JSON.parse(q.questions) as Question[]).length : 0;
              const name = q.kind === 'quiz' ? 'Quiz rápido' : 'Simulacro';
              return (
                <div key={q.id} className="card-row">
                  <div className="card-row-text">
                    <strong>
                      {name} · {shortDate(q.created_at)}
                    </strong>
                    {q.status === 'generating' && (
                      <span className="muted" role="status">
                        La IA lo está preparando. {q.step}
                      </span>
                    )}
                    {q.status === 'error' && <span className="error">No se pudo crear: {q.error}</span>}
                    {q.status === 'ready' && (
                      <>
                        <span className="muted">
                          {count} preguntas{q.kind === 'exam' ? ` · ${q.minutes} minutos` : ''}
                          {q.error ? ` · ${q.error}` : ''}
                        </span>
                        <span className={q.best !== null ? 'badge' : 'badge off'}>
                          {q.attempts === 0
                            ? 'Sin hacer'
                            : q.best === null
                              ? 'Corrigiendo…'
                              : `Mejor nota: ${formatScore(q.best)} · ${q.attempts === 1 ? '1 intento' : `${q.attempts} intentos`}`}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="row">
                    {q.status === 'ready' && (
                      <>
                        <Link className="btn" href={`/test/${q.id}`}>
                          {q.attempts === 0 ? 'Empezar' : 'Repetir'}
                        </Link>
                        {q.last_attempt && (
                          <Link className="btn ghost" href={`/intento/${q.last_attempt}`}>
                            Corrección
                          </Link>
                        )}
                        {q.kind === 'exam' && (
                          <Link className="btn ghost" href={`/test/${q.id}/imprimir`}>
                            Imprimir
                          </Link>
                        )}
                      </>
                    )}
                    {q.status !== 'generating' && (
                      <form action={deleteQuiz}>
                        <input type="hidden" name="quizId" value={q.id} />
                        <ConfirmButton message="¿Borrar este test y sus intentos? No se puede deshacer.">Borrar</ConfirmButton>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
