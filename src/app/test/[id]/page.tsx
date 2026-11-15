import { notFound, redirect } from 'next/navigation';
import { ExamRunner } from '@/components/ExamRunner';
import { QuizRunner } from '@/components/QuizRunner';
import { requireProfile } from '@/lib/auth';
import type { Question } from '@/lib/db';
import { getQuizFor } from '@/lib/topics';

export const dynamic = 'force-dynamic';

export default async function TakeTestPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireProfile();
  const found = getQuizFor(me, Number((await params).id));
  if (!found) notFound();
  const { quiz, topic } = found;
  const back = `/tema/${topic.id}/tests`;
  if (quiz.status !== 'ready' || !quiz.questions) redirect(back);
  const questions = JSON.parse(quiz.questions) as Question[];

  return (
    <div className={`stage-${topic.stage}`}>
      {quiz.kind === 'quiz' ? (
        <QuizRunner quizId={quiz.id} questions={questions.filter((q) => q.type === 'choice')} backHref={back} />
      ) : (
        <>
          <h1>Simulacro · {topic.title}</h1>
          <p className="muted">
            {topic.subject} · {questions.length} preguntas · {quiz.minutes} minutos. Al acabar el tiempo se entrega solo.
          </p>
          {/* Al navegador solo llegan los enunciados: las soluciones se quedan en el servidor. */}
          <ExamRunner
            quizId={quiz.id}
            minutes={quiz.minutes}
            backHref={back}
            questions={questions.map((q) => ({ type: q.type, question: q.question, options: q.options, points: q.points }))}
          />
        </>
      )}
    </div>
  );
}
