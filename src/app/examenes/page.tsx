import Link from 'next/link';
import { ExamList } from '@/components/ExamList';
import { requireStudent } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listExams } from '@/lib/exams';
import { activeCourse } from '@/lib/overview';

export const dynamic = 'force-dynamic';

/** Exámenes del colegio apuntados: los que vienen y los que ya pasaron. */
export default async function ExamsPage() {
  const me = await requireStudent();
  const course = activeCourse(me.id);
  const all = listExams({ profileId: me.id, includePast: true });
  const upcoming = all.filter((e) => e.days >= 0);
  const past = all.filter((e) => e.days < 0).reverse();
  const subjects = course
    ? (getDb().prepare('SELECT id, name FROM subjects WHERE course_id = ? ORDER BY name').all(course.id) as {
        id: number;
        name: string;
      }[])
    : [];

  return (
    <div className={`stage-${course?.stage ?? 'otro'}`}>
      <h1>Exámenes</h1>
      <p className="muted">Cada examen tiene su ruta de estudio, para llegar al día con todo preparado.</p>

      <h2>Próximos</h2>
      {upcoming.length === 0 ? (
        <div className="empty">No tienes ningún examen apuntado.</div>
      ) : (
        <ExamList exams={upcoming} showSubject />
      )}

      <h2>Apuntar un examen</h2>
      {subjects.length === 0 ? (
        <p className="muted">
          Primero crea una asignatura en <Link href="/temas">Mis temas</Link>.
        </p>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Los exámenes se apuntan dentro de su asignatura. Elige cuál:
          </p>
          <div className="row">
            {subjects.map((s) => (
              <Link key={s.id} href={`/asignatura/${s.id}`} className="btn chip">
                {s.name}
              </Link>
            ))}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <h2>Ya pasados</h2>
          <ExamList exams={past} showSubject />
        </>
      )}
    </div>
  );
}
