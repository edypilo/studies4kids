import { getDb, type Course } from './db';
import { topicSteps } from './exams';

/** Un tema con lo conseguido en él: tarjetas, mejores notas y pasos de la ruta completados. */
export type TopicProgress = {
  id: number;
  title: string;
  subject: string;
  color: string;
  cards: number;
  studied: number;
  quiz: number | null;
  exam: number | null;
  explain: number | null;
  stepsDone: number;
  stepsTotal: number;
};

export function activeCourse(profileId: number): Course | null {
  const row = getDb().prepare('SELECT * FROM courses WHERE profile_id = ? AND active = 1').get(profileId) as Course | undefined;
  return row ? { ...row } : null;
}

/** Los temas de un curso, por asignatura, con su avance. */
export function courseTopics(courseId: number): TopicProgress[] {
  const rows = getDb()
    .prepare(
      `SELECT t.id, t.title, s.name AS subject, s.color,
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
    .all(courseId) as Omit<TopicProgress, 'stepsDone' | 'stepsTotal'>[];
  return rows.map((r) => {
    const steps = topicSteps(r.id);
    return { ...r, stepsDone: steps.filter((s) => s.done).length, stepsTotal: steps.length };
  });
}

export type Mastery = {
  /** Porcentaje de pasos de la ruta completados entre todos los temas. */
  percent: number;
  /** Temas con la ruta completa. */
  mastered: number;
  /** Temas empezados pero sin terminar. */
  ongoing: number;
  /** Temas sin ningún paso hecho. */
  untouched: number;
  total: number;
};

export function mastery(topics: TopicProgress[]): Mastery {
  const done = topics.reduce((sum, t) => sum + t.stepsDone, 0);
  const all = topics.reduce((sum, t) => sum + t.stepsTotal, 0);
  const mastered = topics.filter((t) => t.stepsTotal > 0 && t.stepsDone === t.stepsTotal).length;
  const untouched = topics.filter((t) => t.stepsDone === 0).length;
  return {
    percent: all ? Math.round((done / all) * 100) : 0,
    mastered,
    ongoing: topics.length - mastered - untouched,
    untouched,
    total: topics.length,
  };
}
