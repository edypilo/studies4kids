import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExamList } from '@/components/ExamList';
import { ProgressSummary } from '@/components/Progress';
import { requireParent } from '@/lib/auth';
import { TopicProgressTable } from '@/components/TopicProgressTable';
import { getDb, type Profile } from '@/lib/db';
import { activeCourse, courseTopics } from '@/lib/overview';
import { listExams } from '@/lib/exams';
import { getStats } from '@/lib/progress';
import { formatScore } from '@/lib/topics';

export const dynamic = 'force-dynamic';

/** Progreso de un hijo, para los padres: actividad de la semana, exámenes y avance tema a tema. */
export default async function ChildProgressPage({ params }: { params: Promise<{ id: string }> }) {
  await requireParent();
  const db = getDb();
  const child = db
    .prepare("SELECT id, name, role, color, pin_hash FROM profiles WHERE id = ? AND role = 'student'")
    .get(Number((await params).id)) as Profile | undefined;
  if (!child) notFound();

  const course = activeCourse(child.id);
  const stats = getStats(child.id);
  const exams = listExams({ profileId: child.id });
  const topics = course ? courseTopics(course.id) : [];
  const w = stats.week;

  return (
    <>
      <div className="crumbs">
        <Link href="/padres">Panel de padres</Link> ›
      </div>
      <h1>Progreso de {child.name}</h1>
      <p className="muted">{course ? `${course.name} · ${course.school_year}` : 'Sin curso activo'}</p>

      <ProgressSummary stats={stats} forParent />

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

      <h2>Próximos exámenes</h2>
      {exams.length === 0 ? (
        <div className="empty">No tiene ningún examen apuntado.</div>
      ) : (
        <ExamList exams={exams} showSubject />
      )}

      <h2>Tema a tema</h2>
      {topics.length === 0 ? (
        <div className="empty">Todavía no ha creado temas en este curso.</div>
      ) : (
        <TopicProgressTable topics={topics} />
      )}
    </>
  );
}
