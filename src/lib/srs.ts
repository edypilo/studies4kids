/** Repetición espaciada, versión simplificada de SM-2 con tres respuestas. */
export type Grade = 'again' | 'hard' | 'good';

export type SrsState = { interval_days: number; ease: number; reps: number; lapses: number };

const TEN_MINUTES = 10 * 60 * 1000;

/** Devuelve el nuevo estado y cuándo toca volver a ver la tarjeta. */
export function schedule(card: SrsState, grade: Grade, now = Date.now()): SrsState & { due_at: number } {
  let { interval_days, ease, reps, lapses } = card;

  if (grade === 'again') {
    // Fallo: vuelve a empezar y reaparece enseguida.
    return { interval_days: 0, ease: Math.max(1.3, ease - 0.2), reps: 0, lapses: lapses + 1, due_at: now + TEN_MINUTES };
  }
  if (grade === 'hard') {
    ease = Math.max(1.3, ease - 0.15);
    interval_days = reps === 0 ? 1 : Math.max(1, interval_days * 1.2);
  } else {
    interval_days = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(1, interval_days * ease);
  }
  reps += 1;
  interval_days = Math.round(interval_days * 10) / 10;

  // Toca desde primera hora del día correspondiente, no a la misma hora exacta.
  const due = new Date(now);
  due.setHours(0, 0, 0, 0);
  due.setDate(due.getDate() + Math.max(1, Math.round(interval_days)));
  return { interval_days, ease, reps, lapses, due_at: due.getTime() };
}
