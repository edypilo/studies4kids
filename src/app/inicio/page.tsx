import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Icon } from '@/components/Icons';
import { NewCourseForm } from '@/components/NewCourseForm';
import { requireStudent } from '@/lib/auth';
import { countdown, listExams, longDate } from '@/lib/exams';
import { activeCourse, courseTopics, mastery } from '@/lib/overview';
import { getStats } from '@/lib/progress';
import { dueCount } from '@/lib/topics';

export const dynamic = 'force-dynamic';

const RING = 2 * Math.PI * 42;

/** Inicio del alumno: saludo y racha, accesos a lo que toca hoy, avance del curso y próximo examen. */
export default async function Home({ searchParams }: { searchParams: Promise<{ curso?: string }> }) {
  const me = await requireStudent();
  // Los cursos anteriores se consultan ahora desde "Mis temas"; se conservan los enlaces antiguos.
  const { curso } = await searchParams;
  if (curso) redirect(`/temas?curso=${encodeURIComponent(curso)}`);

  const course = activeCourse(me.id);
  if (!course) {
    return (
      <>
        <h1>¡Hola, {me.name}!</h1>
        <p className="muted">Todavía no tienes ningún curso. Crea el primero:</p>
        <NewCourseForm profileId={me.id} current={null} />
      </>
    );
  }

  const stats = getStats(me.id);
  const topics = courseTopics(course.id);
  const m = mastery(topics);
  const subjects = new Set(topics.map((t) => t.subject)).size;
  const due = dueCount(me.id);
  const exams = listExams({ profileId: me.id });
  const next = exams[0];
  const tested = topics.filter((t) => t.quiz !== null || t.exam !== null).length;

  const lead = next
    ? 'Sigue con tu plan y llega al examen con todo preparado.'
    : due > 0
      ? 'Un rato de repaso hoy y mañana lo recordarás mejor.'
      : 'Sube el temario de lo que estés dando y empieza a estudiarlo.';

  return (
    <div className={`home stage-${course.stage}`}>
      <header className="home-head">
        <div>
          <h1>¡Hola, {me.name}!</h1>
          <p className="muted">{lead}</p>
        </div>
        <Link href="/progreso" className={`streak${stats.streak > 0 ? ' on' : ''}`}>
          <Icon name="flame" size={20} />
          <span>
            Racha: <strong>{stats.streak === 1 ? '1 día' : `${stats.streak} días`}</strong>
          </span>
        </Link>
      </header>

      <nav className="quick" aria-label="Accesos rápidos">
        <Link href="/temas" className="quick-card blue">
          <Icon name="layers" size={36} />
          <strong>Mis temas</strong>
          <span>
            {topics.length === 0
              ? 'Crea tu primera asignatura.'
              : `${subjects} ${subjects === 1 ? 'asignatura' : 'asignaturas'}, ${topics.length} ${topics.length === 1 ? 'tema' : 'temas'}.`}
          </span>
          <Icon name="arrow" size={18} />
        </Link>
        <Link href="/repasar" className="quick-card mint">
          <Icon name="cards" size={36} />
          <strong>Repasar</strong>
          <span>
            {due === 0 ? 'Hoy estás al día.' : due === 1 ? '1 tarjeta para hoy.' : `${due} tarjetas para hoy.`}
          </span>
          <Icon name="arrow" size={18} />
        </Link>
        <Link href="/tests" className="quick-card yellow">
          <Icon name="check" size={36} />
          <strong>Tests</strong>
          <span>
            {topics.length === 0
              ? 'Pon a prueba lo que sabes.'
              : tested === 0
                ? 'Aún no has hecho ninguno.'
                : `Hechos en ${tested} de ${topics.length} temas.`}
          </span>
          <Icon name="arrow" size={18} />
        </Link>
      </nav>

      <div className="home-row">
        <section className="card panel" aria-labelledby="h-progreso">
          <h2 id="h-progreso">
            <Icon name="chart" size={20} /> Mi progreso
          </h2>
          {m.total === 0 ? (
            <p className="muted">Cuando tengas temas, aquí verás cuánto llevas de cada uno.</p>
          ) : (
            <div className="mastery">
              <svg className="ring" viewBox="0 0 100 100" role="img" aria-label={`${m.percent}% de la ruta de estudio completada`}>
                <circle cx="50" cy="50" r="42" className="ring-track" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="ring-value"
                  strokeDasharray={`${(m.percent / 100) * RING} ${RING}`}
                  transform="rotate(-90 50 50)"
                />
                <text x="50" y="50" textAnchor="middle" dominantBaseline="central">
                  {m.percent} %
                </text>
              </svg>
              <ul className="mastery-list">
                <li className="done">
                  Temas dominados: <strong>{m.mastered}</strong>
                </li>
                <li className="ongoing">
                  En marcha: <strong>{m.ongoing}</strong>
                </li>
                <li className="untouched">
                  Sin empezar: <strong>{m.untouched}</strong>
                </li>
              </ul>
            </div>
          )}
          <Link href="/progreso" className="panel-link">
            Ver todo el progreso <Icon name="arrow" size={16} />
          </Link>
        </section>

        <section className="card panel" aria-labelledby="h-examen">
          <h2 id="h-examen">
            <Icon name="calendar" size={20} /> Próximo examen
          </h2>
          {next ? (
            <>
              <Link href={`/examen/${next.id}`} className="next-exam">
                <span className="next-exam-text">
                  <strong>{next.title}</strong>
                  <span className="muted">
                    {next.subject} · {longDate(next.date)}
                  </span>
                </span>
                <span className={`next-exam-when${next.days <= 3 ? ' soon' : ''}`}>{countdown(next.days)}</span>
              </Link>
              <div className="progress" role="img" aria-label={`Preparado al ${next.percent}%`}>
                <div style={{ width: `${next.percent}%` }} />
              </div>
              <p className="muted next-exam-note">Preparado al {next.percent}%</p>
            </>
          ) : (
            <p className="muted">No tienes exámenes apuntados. Apunta el siguiente y tendrás su ruta de estudio.</p>
          )}
          <Link href="/examenes" className="panel-link">
            {exams.length > 1 ? `Ver los ${exams.length} exámenes` : next ? 'Ver los exámenes' : 'Apuntar un examen'}{' '}
            <Icon name="arrow" size={16} />
          </Link>
        </section>
      </div>
    </div>
  );
}
