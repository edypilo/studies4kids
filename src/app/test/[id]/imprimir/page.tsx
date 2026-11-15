import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PrintButton } from '@/components/PrintButton';
import { requireProfile } from '@/lib/auth';
import type { Question } from '@/lib/db';
import { getQuizFor } from '@/lib/topics';

export const dynamic = 'force-dynamic';

const LETTERS = 'abcdefgh';

/** Versión del simulacro para imprimir y hacer en papel, sin soluciones. */
export default async function PrintTestPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireProfile();
  const found = getQuizFor(me, Number((await params).id));
  if (!found) notFound();
  const { quiz, topic } = found;
  const back = `/tema/${topic.id}/tests`;
  if (quiz.status !== 'ready' || !quiz.questions) redirect(back);
  const questions = JSON.parse(quiz.questions) as Question[];
  const total = questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <div className="print-sheet">
      <div className="row between no-print" style={{ marginBottom: 16 }}>
        <Link href={back} className="muted">
          ← Volver a los tests
        </Link>
        <PrintButton />
      </div>
      <h1>
        {topic.subject} · {topic.title}
      </h1>
      <p>
        {topic.course} · Examen de práctica · {quiz.minutes > 0 ? `${quiz.minutes} minutos · ` : ''}
        {total} puntos
      </p>
      <p className="print-name">Nombre: ______________________________ Fecha: ______________</p>
      <ol className="print-questions">
        {questions.map((q, i) => (
          <li key={i}>
            <p>
              {q.question} <em>({q.points === 1 ? '1 punto' : `${q.points} puntos`})</em>
            </p>
            {q.type === 'choice' ? (
              <ul className="print-options">
                {q.options.map((option, k) => (
                  <li key={k}>
                    {LETTERS[k]}) {option}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="print-lines" style={{ height: `${q.points >= 4 ? 9 : 4.5}em` }} />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
