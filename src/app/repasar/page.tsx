import Link from 'next/link';
import { StudySession } from '@/components/StudySession';
import { requireStudent } from '@/lib/auth';
import { getDb, type Stage } from '@/lib/db';
import { dueCards, dueCount } from '@/lib/topics';

export const dynamic = 'force-dynamic';

/** Repaso del día: las tarjetas que tocan hoy de todas las asignaturas, en tandas de 30. */
export default async function ReviewPage() {
  const me = await requireStudent();
  const cards = dueCards(me.id, { limit: 30 });
  const total = dueCount(me.id);
  const course = getDb().prepare('SELECT stage FROM courses WHERE profile_id = ? AND active = 1').get(me.id) as
    | { stage: Stage }
    | undefined;

  if (cards.length === 0) {
    return (
      <div className="study-done card">
        <h1>¡Al día!</h1>
        <p>Hoy no te queda ninguna tarjeta por repasar.</p>
        <Link className="btn" href="/inicio">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className={`stage-${course?.stage ?? 'otro'}`}>
      {total > cards.length && (
        <p className="muted">
          Tienes {total} tarjetas para hoy. Vamos por tandas de {cards.length}.
        </p>
      )}
      <StudySession cards={cards} mode="review" backHref="/inicio" backLabel="Volver al inicio" />
    </div>
  );
}
