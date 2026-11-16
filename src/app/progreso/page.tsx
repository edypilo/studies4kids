import { ProgressSummary } from '@/components/Progress';
import { NoTopics } from '@/components/TopicPicker';
import { TopicProgressTable } from '@/components/TopicProgressTable';
import { requireStudent } from '@/lib/auth';
import { activeCourse, courseTopics } from '@/lib/overview';
import { getStats } from '@/lib/progress';
import { formatScore } from '@/lib/topics';

export const dynamic = 'force-dynamic';

/** El progreso del alumno: racha y puntos, lo hecho esta semana y el avance tema a tema. */
export default async function ProgressPage() {
  const me = await requireStudent();
  const course = activeCourse(me.id);
  const stats = getStats(me.id);
  const topics = course ? courseTopics(course.id) : [];
  const w = stats.week;

  return (
    <div className={`stage-${course?.stage ?? 'otro'}`}>
      <h1>Progreso</h1>
      <p className="muted">{course ? `${course.name} · ${course.school_year}` : 'Sin curso activo'}</p>

      <ProgressSummary stats={stats} />

      <h2>Esta semana</h2>
      <div className="child-stats card">
        <span>
          Tarjetas repasadas: <strong>{w.cards}</strong>
          {w.cards > 0 ? ` (${Math.round((w.cardsKnown / w.cards) * 100)}% sabidas a la primera)` : ''}
        </span>
        <span>
          Quiz rápidos: <strong>{w.quizzes}</strong>
          {w.quizAvg !== null ? ` (nota media ${formatScore(w.quizAvg)})` : ''}
        </span>
        <span>
          Simulacros: <strong>{w.exams}</strong>
          {w.examAvg !== null ? ` (nota media ${formatScore(w.examAvg)})` : ''}
        </span>
        <span>
          Explicaciones: <strong>{w.explains}</strong>
        </span>
      </div>

      <h2>Tema a tema</h2>
      {topics.length === 0 ? <NoTopics /> : <TopicProgressTable topics={topics} />}
    </div>
  );
}
