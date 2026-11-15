import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoRefresh } from '@/components/AutoRefresh';
import { regradeAttempt } from '@/lib/actions';
import { requireProfile } from '@/lib/auth';
import { getDb, type Answer, type Question, type QuestionResult, type QuizAttempt } from '@/lib/db';
import { formatScore, getQuizFor } from '@/lib/topics';

export const dynamic = 'force-dynamic';

const LETTERS = 'abcdefgh';

function points(n: number): string {
  return String(n).replace('.', ',');
}

/** Corrección de un intento: nota y repaso pregunta a pregunta. */
export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireProfile();
  const attempt = getDb().prepare('SELECT * FROM quiz_attempts WHERE id = ?').get(Number((await params).id)) as
    | QuizAttempt
    | undefined;
  const found = attempt ? getQuizFor(me, attempt.quiz_id) : null;
  if (!attempt || !found?.quiz.questions) notFound();
  const { quiz, topic } = found;
  const questions = JSON.parse(quiz.questions!) as Question[];
  const answers = JSON.parse(attempt.answers) as Answer[];
  const results = attempt.results ? (JSON.parse(attempt.results) as QuestionResult[]) : null;
  const back = `/tema/${topic.id}/tests`;

  return (
    <div className={`stage-${topic.stage}`}>
      <div className="crumbs">
        <Link href={`/tema/${topic.id}`}>{topic.title}</Link> › <Link href={back}>Tests</Link> ›
      </div>
      <h1>{quiz.kind === 'quiz' ? 'Quiz rápido' : 'Simulacro'} · corrección</h1>

      {attempt.status === 'grading' && (
        <>
          <AutoRefresh />
          <div className="banner" role="status">
            <strong>La IA está corrigiendo tus respuestas.</strong> Tarda alrededor de un minuto; la nota aparecerá aquí
            sola.
          </div>
        </>
      )}
      {attempt.status === 'error' && (
        <div className="banner">
          <p className="error">No se pudo corregir: {attempt.error}</p>
          <form action={regradeAttempt}>
            <input type="hidden" name="attemptId" value={attempt.id} />
            <button className="btn">Volver a corregir</button>
          </form>
        </div>
      )}

      {attempt.status === 'done' && attempt.score !== null && (
        <div className={`score ${attempt.score >= 5 ? 'pass' : 'fail'}`}>
          <span className="score-number">{formatScore(attempt.score)}</span>
          <span>
            sobre 10 ·{' '}
            {attempt.score >= 9
              ? '¡Sobresaliente!'
              : attempt.score >= 7
                ? '¡Muy bien!'
                : attempt.score >= 5
                  ? 'Aprobado, pero se puede mejorar.'
                  : 'Toca repasar este tema.'}
          </span>
        </div>
      )}

      {results && (
        <div className="list" style={{ marginTop: 18 }}>
          {questions.map((q, i) => {
            const r = results[i];
            const answer = answers[i];
            const full = r.earned >= q.points;
            return (
              <div key={i} className={`card review ${full ? 'right' : r.earned > 0 ? 'partial' : 'wrong'}`}>
                <div className="row between">
                  <strong>Pregunta {i + 1}</strong>
                  <span className="badge off">
                    {points(r.earned)} de {points(q.points)}
                  </span>
                </div>
                <p className="exam-text">{q.question}</p>
                {q.type === 'choice' ? (
                  <ul className="review-options">
                    {q.options.map((option, k) => (
                      <li key={k} className={k === q.correct_index ? 'right' : k === answer ? 'wrong' : ''}>
                        {LETTERS[k]}) {option}
                        {k === q.correct_index ? ' ✓' : k === answer ? ' ✗ (tu respuesta)' : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <>
                    <p className="review-label">Tu respuesta</p>
                    <p className="review-answer">{typeof answer === 'string' ? answer : 'Sin responder.'}</p>
                    <p className="review-label">Corrección</p>
                    <p>{r.feedback}</p>
                  </>
                )}
                {answer === null && q.type === 'choice' && <p className="muted">La dejaste sin responder.</p>}
                {q.explanation && (
                  <details open={!full}>
                    <summary className="muted">{q.type === 'choice' ? 'Explicación' : 'Respuesta modelo'}</summary>
                    <p>{q.explanation}</p>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="row" style={{ marginTop: 20 }}>
        <Link className="btn" href={back}>
          Volver a los tests
        </Link>
        <Link className="btn ghost" href={`/test/${quiz.id}`}>
          Repetir este test
        </Link>
      </div>
    </div>
  );
}
