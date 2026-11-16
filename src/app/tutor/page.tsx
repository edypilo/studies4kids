import { NoTopics, TopicPicker } from '@/components/TopicPicker';
import { requireStudent } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { activeCourse, courseTopics } from '@/lib/overview';

export const dynamic = 'force-dynamic';

/** El tutor responde sobre el material de un tema concreto: aquí se elige cuál. */
export default async function TutorPage() {
  const me = await requireStudent();
  const course = activeCourse(me.id);
  const topics = course ? courseTopics(course.id) : [];
  const asked = new Map(
    (
      getDb()
        .prepare("SELECT topic_id, COUNT(*) AS n FROM chat_messages WHERE role = 'user' GROUP BY topic_id")
        .all() as { topic_id: number; n: number }[]
    ).map((r) => [r.topic_id, r.n]),
  );

  return (
    <div className={`stage-${course?.stage ?? 'otro'}`}>
      <h1>Tutor IA</h1>
      <p className="muted">
        Pregunta tus dudas sobre un tema. El tutor te da pistas para que llegues tú a la respuesta, y solo habla del
        material que has subido.
      </p>
      {topics.length === 0 ? (
        <NoTopics />
      ) : (
        <TopicPicker
          topics={topics}
          hrefOf={(t) => `/tema/${t.id}/tutor`}
          detailOf={(t) => {
            const n = asked.get(t.id) ?? 0;
            return n === 0 ? 'Sin preguntas todavía' : n === 1 ? '1 pregunta hecha' : `${n} preguntas hechas`;
          }}
        />
      )}
    </div>
  );
}
