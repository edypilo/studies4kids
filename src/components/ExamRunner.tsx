'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { submitQuiz } from '@/lib/actions';
import type { Answer } from '@/lib/db';

/** Pregunta tal como la ve el alumno durante el examen: sin la solución. */
export type ExamQuestion = { type: 'choice' | 'open'; question: string; options: string[]; points: number };

const LETTERS = 'abcdefgh';

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Simulacro: todas las preguntas, con tiempo, sin ayudas. Se corrige al entregar. */
export function ExamRunner({
  quizId,
  questions,
  minutes,
  backHref,
}: {
  quizId: number;
  questions: ExamQuestion[];
  minutes: number;
  backHref: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answer[]>(() => questions.map(() => null));
  const [left, setLeft] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const sentRef = useRef(false);
  const startKey = `s4k-examen-${quizId}`;

  const submit = useCallback(async () => {
    if (sentRef.current) return;
    sentRef.current = true;
    setSending(true);
    try {
      const attemptId = await submitQuiz(quizId, answersRef.current);
      try {
        sessionStorage.removeItem(startKey);
      } catch {}
      router.push(attemptId ? `/intento/${attemptId}` : backHref);
    } catch {
      sentRef.current = false;
      setSending(false);
      setError('No se pudo entregar. Comprueba la conexión y vuelve a intentarlo.');
    }
  }, [quizId, router, backHref, startKey]);

  // El reloj sobrevive a recargar la página: la hora de inicio se guarda en la pestaña.
  useEffect(() => {
    let start = Date.now();
    try {
      const saved = Number(sessionStorage.getItem(startKey));
      if (saved > 0) start = saved;
      else sessionStorage.setItem(startKey, String(start));
    } catch {}
    const tick = () => {
      const remaining = Math.max(0, minutes * 60 - Math.floor((Date.now() - start) / 1000));
      setLeft(remaining);
      if (remaining === 0) void submit();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [minutes, startKey, submit]);

  const setAnswer = (i: number, value: Answer) => setAnswers((a) => a.map((v, k) => (k === i ? value : v)));
  const blank = answers.filter((a) => a === null || a === '').length;

  return (
    <div className="exam">
      <div className="exam-bar">
        <span className={left !== null && left <= 120 ? 'exam-clock low' : 'exam-clock'} role="timer">
          {left === null ? '…' : clock(left)}
        </span>
        <span className="muted">{blank === 0 ? 'Todo contestado' : `${blank} sin contestar`}</span>
      </div>

      {questions.map((q, i) => (
        <fieldset key={i} className="card exam-question">
          <legend>
            Pregunta {i + 1} <span className="muted">· {q.points === 1 ? '1 punto' : `${q.points} puntos`}</span>
          </legend>
          <p className="exam-text">{q.question}</p>
          {q.type === 'choice' ? (
            <div className="options">
              {q.options.map((option, k) => (
                <label key={k} className={`option${answers[i] === k ? ' picked' : ''}`}>
                  <input type="radio" name={`q${i}`} checked={answers[i] === k} onChange={() => setAnswer(i, k)} />
                  <span className="option-letter">{LETTERS[k]}</span>
                  <span>{option}</span>
                </label>
              ))}
            </div>
          ) : (
            <textarea
              rows={q.points >= 4 ? 8 : 4}
              placeholder="Escribe aquí tu respuesta"
              aria-label={`Respuesta a la pregunta ${i + 1}`}
              value={typeof answers[i] === 'string' ? (answers[i] as string) : ''}
              onChange={(e) => setAnswer(i, e.target.value)}
              maxLength={4000}
            />
          )}
        </fieldset>
      ))}

      {error && <p className="error">{error}</p>}
      <button className="btn" onClick={() => void submit()} disabled={sending}>
        {sending ? 'Entregando…' : 'Entregar el examen'}
      </button>
    </div>
  );
}
