import { canAccess } from './auth';
import { getDb, type Profile, type Quiz, type Stage } from './db';

export type TopicRow = {
  id: number;
  title: string;
  subject_id: number;
  subject: string;
  course_id: number;
  course: string;
  stage: Stage;
  active: number;
  profile_id: number;
};

/** El tema con su asignatura y curso, o null si no existe o el perfil no puede verlo. */
export function getTopicFor(profile: Profile, topicId: number): TopicRow | null {
  const topic = getDb()
    .prepare(
      `SELECT t.id, t.title, t.subject_id, s.name AS subject, c.id AS course_id, c.name AS course,
              c.stage, c.active, c.profile_id
         FROM topics t
         JOIN subjects s ON s.id = t.subject_id
         JOIN courses c ON c.id = s.course_id
        WHERE t.id = ?`,
    )
    .get(topicId) as TopicRow | undefined;
  return topic && canAccess(profile, topic.profile_id) ? topic : null;
}

/** Un test con su tema, o null si no existe o el perfil no puede verlo. */
export function getQuizFor(profile: Profile, quizId: number): { quiz: Quiz; topic: TopicRow } | null {
  const quiz = getDb().prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId) as Quiz | undefined;
  const topic = quiz ? getTopicFor(profile, quiz.topic_id) : null;
  return quiz && topic ? { quiz, topic } : null;
}

/** Fecha corta en español a partir de la marca de tiempo UTC de SQLite. */
export function shortDate(sqliteUtc: string): string {
  return new Date(`${sqliteUtc.replace(' ', 'T')}Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export function formatScore(score: number): string {
  return score.toFixed(1).replace('.', ',').replace(',0', '');
}

export type StudyCard ={ id: number; front: string; back: string; label: string };

/** Momento a partir del cual una tarjeta cuenta como "para hoy": todo lo que venza antes de acabar el día. */
export function endOfToday(now = new Date()): number {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

/** Cuántas tarjetas tiene pendientes hoy un alumno (nuevas incluidas). */
export function dueCount(profileId: number): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM flashcards f
         JOIN topics t ON t.id = f.topic_id
         JOIN subjects s ON s.id = t.subject_id
         JOIN courses c ON c.id = s.course_id
        WHERE c.profile_id = ? AND f.due_at <= ?`,
    )
    .get(profileId, endOfToday()) as { n: number };
  return row.n;
}

/** Tarjetas pendientes hoy: primero los repasos y después las nuevas. Opcionalmente de un solo tema. */
export function dueCards(profileId: number, opts: { topicId?: number; limit?: number } = {}): StudyCard[] {
  const rows = getDb()
    .prepare(
      `SELECT f.id, f.front, f.back, s.name || ' · ' || t.title AS label
         FROM flashcards f
         JOIN topics t ON t.id = f.topic_id
         JOIN subjects s ON s.id = t.subject_id
         JOIN courses c ON c.id = s.course_id
        WHERE c.profile_id = ? AND f.due_at <= ? AND (? IS NULL OR f.topic_id = ?)
        ORDER BY f.reps = 0, f.due_at, f.id
        LIMIT ?`,
    )
    .all(profileId, endOfToday(), opts.topicId ?? null, opts.topicId ?? null, opts.limit ?? 30) as StudyCard[];
  // Las filas de SQLite no son objetos planos y no se pueden pasar tal cual a un componente de cliente.
  return rows.map((r) => ({ id: r.id, front: r.front, back: r.back, label: r.label }));
}
