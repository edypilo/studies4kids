'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { finishLearnSession, gradeCard } from '@/lib/actions';
import type { Grade } from '@/lib/srs';
import type { StudyCard } from '@/lib/topics';

type Props = {
  cards: StudyCard[];
  /** learn: ronda libre hasta sabérselas todas, no cambia el calendario. review: repaso espaciado, se guarda. */
  mode: 'learn' | 'review';
  backHref: string;
  backLabel: string;
};

const ANSWERS: { grade: Grade; label: string; className: string }[] = [
  { grade: 'again', label: 'No me la sabía', className: 'btn answer again' },
  { grade: 'hard', label: 'Regular', className: 'btn answer hard' },
  { grade: 'good', label: 'Me la sabía', className: 'btn answer good' },
];

export function StudySession({ cards, mode, backHref, backLabel }: Props) {
  const [queue, setQueue] = useState(cards);
  const [flipped, setFlipped] = useState(false);
  const [misses, setMisses] = useState(0);
  const current = queue[0];

  const answer = useCallback(
    (grade: Grade) => {
      if (!current) return;
      if (mode === 'review') void gradeCard(current.id, grade).catch(() => {});
      const again = grade === 'again' || (mode === 'learn' && grade === 'hard');
      if (grade === 'again') setMisses((n) => n + 1);
      // Última tarjeta de una ronda de Aprender: se apunta para la racha y los puntos.
      if (mode === 'learn' && !again && queue.length === 1) void finishLearnSession(cards.length).catch(() => {});
      setQueue((q) => (again ? [...q.slice(1), current] : q.slice(1)));
      setFlipped(false);
    },
    [current, mode, queue.length, cards.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ['1', '2', '3'].includes(e.key)) {
        answer(ANSWERS[Number(e.key) - 1].grade);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, flipped, answer]);

  if (!current) {
    return (
      <div className="study-done card">
        <h1>¡Hecho!</h1>
        <p>
          Has terminado {cards.length === 1 ? 'la tarjeta' : `las ${cards.length} tarjetas`}.{' '}
          {misses === 0 ? 'Sin ningún fallo.' : misses === 1 ? 'Solo has fallado una vez.' : `Has fallado ${misses} veces.`}
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          {mode === 'learn' && (
            <button
              className="btn ghost"
              onClick={() => {
                setQueue(cards);
                setMisses(0);
              }}
            >
              Otra ronda
            </button>
          )}
          <Link className="btn" href={backHref}>
            {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  const remaining = new Set(queue.map((c) => c.id)).size;
  const completed = cards.length - remaining;

  return (
    <div className="study">
      <div className="row between">
        <span className="muted">
          {completed} de {cards.length} · {mode === 'learn' ? 'Aprender' : 'Repaso'}
        </span>
        <Link href={backHref} className="muted">
          Salir
        </Link>
      </div>
      <div className="progress" aria-hidden="true">
        <div style={{ width: `${(completed / cards.length) * 100}%` }} />
      </div>

      <button className={`flashcard${flipped ? ' flipped' : ''}`} onClick={() => setFlipped((f) => !f)} aria-live="polite">
        <span className="flashcard-label">{current.label}</span>
        <span className="flashcard-side">{flipped ? 'Respuesta' : 'Pregunta'}</span>
        <span className="flashcard-text">{flipped ? current.back : current.front}</span>
        {!flipped && <span className="flashcard-hint">Piensa la respuesta y toca para verla</span>}
      </button>

      {flipped ? (
        <div className="answers">
          {ANSWERS.map((a) => (
            <button key={a.grade} className={a.className} onClick={() => answer(a.grade)}>
              {a.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="answers">
          <button className="btn" onClick={() => setFlipped(true)}>
            Ver respuesta
          </button>
        </div>
      )}
    </div>
  );
}
