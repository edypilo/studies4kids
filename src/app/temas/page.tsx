import Link from 'next/link';
import { NewCourseForm } from '@/components/NewCourseForm';
import { addSubject } from '@/lib/actions';
import { requireStudent } from '@/lib/auth';
import { SUGGESTED_SUBJECTS, getDb, type Course } from '@/lib/db';

export const dynamic = 'force-dynamic';

type SubjectRow = { id: number; name: string; color: string; topics: number };

/** Asignaturas del curso, con sus temas dentro. Desde aquí también se pasa de curso y se consultan los anteriores. */
export default async function SubjectsPage({ searchParams }: { searchParams: Promise<{ curso?: string }> }) {
  const me = await requireStudent();
  const { curso } = await searchParams;
  const db = getDb();

  const courses = db.prepare('SELECT * FROM courses WHERE profile_id = ? ORDER BY active DESC, id DESC').all(me.id) as Course[];
  const active = courses.find((c) => c.active) ?? null;
  const course = courses.find((c) => c.id === Number(curso)) ?? active;

  if (!course) {
    return (
      <>
        <h1>Mis temas</h1>
        <p className="muted">Todavía no tienes ningún curso. Crea el primero:</p>
        <NewCourseForm profileId={me.id} current={null} />
      </>
    );
  }

  const subjects = db
    .prepare(
      `SELECT s.id, s.name, s.color, (SELECT COUNT(*) FROM topics t WHERE t.subject_id = s.id) AS topics
         FROM subjects s WHERE s.course_id = ? ORDER BY s.name`,
    )
    .all(course.id) as SubjectRow[];
  const taken = new Set(subjects.map((s) => s.name.toLowerCase()));
  const suggestions = SUGGESTED_SUBJECTS[course.stage].filter((n) => !taken.has(n.toLowerCase()));
  const archived = courses.filter((c) => c.id !== course.id);

  return (
    <div className={`stage-${course.stage}`}>
      <h1>Mis temas</h1>
      <p className="muted">
        {course.name} · {course.school_year}{' '}
        {course.active ? <span className="badge">Curso actual</span> : <span className="badge off">Archivado</span>}
      </p>

      {!course.active && (
        <div className="banner">
          Estás viendo un curso anterior. <Link href="/temas">Volver al curso actual →</Link>
        </div>
      )}

      <h2>Asignaturas</h2>
      {subjects.length === 0 ? (
        <div className="empty">Aún no hay asignaturas. Añade la primera aquí abajo.</div>
      ) : (
        <div className="grid">
          {subjects.map((s) => (
            <Link
              key={s.id}
              href={`/asignatura/${s.id}`}
              className="card subject-card"
              style={{ '--c': s.color } as React.CSSProperties}
            >
              <strong>{s.name}</strong>
              <span className="muted">{s.topics === 1 ? '1 tema' : `${s.topics} temas`}</span>
            </Link>
          ))}
        </div>
      )}

      <h2>Añadir asignatura</h2>
      <form action={addSubject} className="row">
        <input type="hidden" name="courseId" value={course.id} />
        <input name="name" className="grow" placeholder="Nombre de la asignatura" aria-label="Nombre de la asignatura" maxLength={80} required />
        <button className="btn">Añadir</button>
      </form>
      {suggestions.length > 0 && (
        <div className="row" style={{ marginTop: 12 }}>
          <span className="muted">Rápido:</span>
          {suggestions.map((name) => (
            <form key={name} action={addSubject}>
              <input type="hidden" name="courseId" value={course.id} />
              <input type="hidden" name="name" value={name} />
              <button className="btn chip">+ {name}</button>
            </form>
          ))}
        </div>
      )}

      <h2>Cursos</h2>
      {archived.length > 0 && (
        <div className="list" style={{ marginBottom: 12 }}>
          {archived.map((c) => (
            <div key={c.id} className="list-item">
              <Link className="title" href={c.active ? '/temas' : `/temas?curso=${c.id}`}>
                {c.name} · {c.school_year}
              </Link>
              <span className={c.active ? 'badge' : 'badge off'}>{c.active ? 'Curso actual' : 'Archivado'}</span>
            </div>
          ))}
        </div>
      )}
      {course.active ? (
        <details className="card">
          <summary>Pasar de curso</summary>
          <p className="muted" style={{ marginTop: 0 }}>
            Se crea el curso nuevo y {course.name} queda archivado: podrás seguir consultándolo.
          </p>
          <NewCourseForm profileId={me.id} current={course} />
        </details>
      ) : null}
    </div>
  );
}
