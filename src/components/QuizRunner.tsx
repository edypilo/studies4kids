'use client';

import Link from 'next/link';
import { useState } from 'react';
import { submitQuiz } from '@/lib/actions';
import type { Question } from '@/lib/db';

const LETTERS = 'abcdefgh';

/** Quiz rápido: una pregunta cada vez, con pista y explicación inmediata. */
export function QuizRunner({ quizId, questions, backHref }: { quizId: number; questions: Question[]; backHref: string }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [hint, setHint] = useState(false);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);

  const q = questions[index];
  const chosen = answers[index];
  const answered = chosen !== null;

  if (finished) {
    const right = questions.filter((qq, i) => answers[i] === qq.correct_index).length;
    return (
      <div className="study-done card">
        <h1>
          {right} de {questions.length}
        </h1>
        <p>
          {right === questions.length
            ? '¡Perfecto, todas bien!'
            : right >= questions.length * 0.7
              ? '¡Muy bien! Repasa las que has fallado.'
              : 'Hay que repasar un poco más este tema.'}
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          {attemptId && (
            <Link className="btn ghost" href={`/intento/${attemptId}`}>
              Ver la corrección
            </Link>
          )}
          <Link className="btn" href={backHref}>
            Volver a los tests
          </Link>
        </div>
      </div>
    );
  }

  const choose = (i: number) => {
    if (answered) return;
    setAnswers((a) => a.map((v, k) => (k === index ? i : v)));
  };

  const next = () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setHint(false);
      return;
    }
    setFinished(true);
    void submitQuiz(quizId, answers)
      .then(setAttemptId)
      .catch(() => {});
  };

  return (
    <div className="study">
      <div className="row between">
        <span className="muted">
          Pregunta {index + 1} de {questions.length}
        </span>
        <Link href={backHref} className="muted">
          Salir
        </Link>
      </div>
      <div className="progress" aria-hidden="true">
        <div style={{ width: `${(index / questions.length) * 100}%` }} />
      </div>

      <h2 className="quiz-question">{q.question}</h2>
      <div className="options">
        {q.options.map((option, i) => {
          const state = !answered ? '' : i === q.correct_index ? ' right' : i === chosen ? ' wrong' : ' dim';
          return (
            <button key={i} className={`option${state}`} onClick={() => choose(i)} disabled={answered}>
              <span className="option-letter">{LETTERS[i]}</span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>

      {!answered && q.hint && (
        <div style={{ marginTop: 14 }}>
          {hint ? (
            <p className="hint">Pista: {q.hint}</p>
          ) : (
            <button className="btn ghost" onClick={() => setHint(true)}>
              Dame una pista
            </button>
          )}
        </div>
      )}

      {answered && (
        <div className={`verdict ${chosen === q.correct_index ? 'right' : 'wrong'}`} role="status">
          <strong>{chosen === q.correct_index ? '¡Correcto!' : 'No es esa.'}</strong>
          {q.explanation && <p>{q.explanation}</p>}
          <button className="btn" onClick={next} autoFocus>
            {index + 1 < questions.length ? 'Siguiente' : 'Ver resultado'}
          </button>
        </div>
      )}
    </div>
  );
}
