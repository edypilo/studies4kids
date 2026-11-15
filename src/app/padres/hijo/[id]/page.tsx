import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExamList } from '@/components/ExamList';
import { ProgressSummary } from '@/components/Progress';
import { requireParent } from '@/lib/auth';
import { getDb, type Course, type Profile } from '@/lib/db';
import { listExams, topicSteps } from '@/lib/exams';
import { getStats } from '@/lib/progress';
import { formatScore } from '@/lib/topics';

export const dynamic = 'force-dynamic';

type TopicRow = {
  id: number;
  title: string;
  subject: string;
  cards: number;
  studied: number;
  quiz: number | null;
  exam: number | null;
  explain: number | null;
};

function score(value: number | null): string {
  return value === null ? '—' : formatScore(value);
}

/** Progreso de un hijo, para los padres: actividad de la semana, exámenes y avance tema a tema. */
export default async function ChildProgressPage({ params }: { params: Promise<{ id: string }> }) {
  await requireParent();
  const db = getDb();
  const child = db
    .prepare("SELECT id, name, role, color, pin_hash FROM profiles WHERE id = ? AND role = 'student'")
    .get(Number((await params).id)) as Profile | undefined;
  if (!child) notFound();

  const course = db.prepare('SELECT * FROM courses WHERE profile_id = ? AND active = 1').get(child.id) as Course | undefined;
  const stats = getStats(child.id);
  const exams = listExams({ profileId: child.id });
  const topics = course
    ? (db
        .prepare(
          `SELECT t.id, t.title, s.name AS subject,
                  (SELECT COUNT(*) FROM flashcards f WHERE f.topic_id = t.id) AS cards,
                  (SELECT COUNT(*) FROM flashcards f WHERE f.topic_id = t.id AND f.reps > 0) AS studied,
                  (SELECT MAX(a.score) FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
                    WHERE q.topic_id = t.id AND q.kind = 'quiz' AND a.status = 'done') AS quiz,
                  (SELECT MAX(a.score) FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
                    WHERE q.topic_id = t.id AND q.kind = 'exam' AND a.status = 'done') AS exam,
                  (SELECT MAX(e.score) FROM explanations e WHERE e.topic_id = t.id AND e.status = 'done') AS explain
             FROM topics t JOIN subjects s ON s.id = t.subject_id
            WHERE s.course_id = ? ORDER BY s.name, t.position, t.id`,
        )
        .all(course.id) as TopicRow[])
    : [];
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
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Tema</th>
                <th className="num">Ruta</th>
                <th className="num">Tarjetas</th>
                <th className="num">Mejor quiz</th>
                <th className="num">Explicación</th>
                <th className="num">Mejor simulacro</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((t) => {
                const steps = topicSteps(t.id);
                return (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/tema/${t.id}`}>
                        <strong>{t.title}</strong>
                      </Link>
                      <br />
                      <span className="muted">{t.subject}</span>
                    </td>
                    <td className="num">
                      {steps.filter((s) => s.done).length} de {steps.length}
                    </td>
                    <td className="num">{t.cards === 0 ? '—' : `${t.studied} de ${t.cards}`}</td>
                    <td className="num">{score(t.quiz)}</td>
                    <td className="num">{score(t.explain)}</td>
                    <td className="num">{score(t.exam)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ marginTop: 10 }}>
        Ruta: pasos completados de los seis de cada tema (material, resumen, tarjetas, quiz, explicación y simulacro).
        Las notas son sobre 10.
      </p>
    </>
  );
}
