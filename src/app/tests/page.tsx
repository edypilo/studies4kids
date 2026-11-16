import Link from 'next/link';
import { NoTopics, TopicPicker } from '@/components/TopicPicker';
import { requireStudent } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { activeCourse, courseTopics, type TopicProgress } from '@/lib/overview';
import { formatScore, shortDate } from '@/lib/topics';

export const dynamic = 'force-dynamic';

type Recent = { id: number; kind: 'quiz' | 'exam'; score: number; created_at: string; topic: string };

function best(t: TopicProgress): string {
  const parts = [
    t.quiz === null ? null : `Mejor quiz: ${formatScore(t.quiz)}`,
    t.exam === null ? null : `Mejor simulacro: ${formatScore(t.exam)}`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Sin hacer todavía';
}

/** Todos los tests del curso: los últimos resultados y la puerta a los tests de cada tema. */
export default async function TestsPage() {
  const me = await requireStudent();
  const course = activeCourse(me.id);
  const topics = course ? courseTopics(course.id) : [];
  const recent = course
    ? (getDb()
        .prepare(
          `SELECT a.id, q.kind, a.score, a.created_at, t.title AS topic
             FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
             JOIN topics t ON t.id = q.topic_id JOIN subjects s ON s.id = t.subject_id
            WHERE s.course_id = ? AND a.status = 'done' AND a.score IS NOT NULL
            ORDER BY a.id DESC LIMIT 5`,
        )
        .all(course.id) as Recent[])
    : [];

  return (
    <div className={`stage-${course?.stage ?? 'otro'}`}>
      <h1>Tests</h1>
      <p className="muted">Quiz rápidos y simulacros de examen. Elige un tema para ponerte a prueba.</p>

      {recent.length > 0 && (
        <>
          <h2>Últimos resultados</h2>
          <div className="list">
            {recent.map((r) => (
              <Link key={r.id} href={`/intento/${r.id}`} className="pick">
                <span className="pick-text">
                  <strong>{r.topic}</strong>
                  <span className="muted">
                    {r.kind === 'quiz' ? 'Quiz rápido' : 'Simulacro'} · {shortDate(r.created_at)}
                  </span>
                </span>
                <span className={`score ${r.score >= 5 ? 'pass' : 'fail'}`}>{formatScore(r.score)}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {topics.length === 0 ? (
        <NoTopics />
      ) : (
        <TopicPicker topics={topics} hrefOf={(t) => `/tema/${t.id}/tests`} detailOf={best} />
      )}
    </div>
  );
}
