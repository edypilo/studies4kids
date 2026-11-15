import { getDb } from './db';
import { todayISO } from './exams';

/**
 * Registro de lo que estudia cada alumno. De aquí salen la racha, los puntos y el panel de padres.
 * kind: card (tarjeta repasada) · learn (ronda de Aprender) · quiz · exam (simulacro) · explain (Explícalo).
 */
export type ActivityKind = 'card' | 'learn' | 'quiz' | 'exam' | 'explain';

/** Como mucho, tres rondas de Aprender puntúan al día: repetirlas sin fin no da más puntos. */
const LEARN_SESSIONS_PER_DAY = 3;

export function logActivity(profileId: number, kind: ActivityKind, points: number, value: number | null, topicId: number | null) {
  getDb()
    .prepare('INSERT INTO activity (profile_id, day, kind, points, value, topic_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(profileId, todayISO(), kind, Math.max(0, Math.round(points)), value, topicId);
}

/** El alumno dueño de un tema (los trabajos de IA corren sin sesión y lo necesitan para puntuar). */
export function ownerOfTopic(topicId: number): number | null {
  const row = getDb()
    .prepare(
      `SELECT c.profile_id FROM topics t JOIN subjects s ON s.id = t.subject_id JOIN courses c ON c.id = s.course_id
        WHERE t.id = ?`,
    )
    .get(topicId) as { profile_id: number } | undefined;
  return row?.profile_id ?? null;
}

export function logLearnSession(profileId: number, cards: number) {
  const { n } = getDb()
    .prepare("SELECT COUNT(*) AS n FROM activity WHERE profile_id = ? AND day = ? AND kind = 'learn'")
    .get(profileId, todayISO()) as { n: number };
  if (n >= LEARN_SESSIONS_PER_DAY || cards <= 0) return;
  logActivity(profileId, 'learn', Math.min(5, cards), cards, null);
}

/** Puntos de un test corregido. Repetir un test ya hecho da solo 2: las preguntas ya se conocen. */
export function pointsForAttempt(kind: 'quiz' | 'exam', score: number, repeated: boolean): number {
  if (repeated) return 2;
  return kind === 'quiz' ? 5 + Math.round(score) : 15 + Math.round(score * 2);
}

export type DayPoints = { day: string; label: string; points: number; today: boolean };

export type Stats = {
  /** Días seguidos estudiando. Sigue viva si hoy aún no ha estudiado pero ayer sí. */
  streak: number;
  studiedToday: boolean;
  pointsWeek: number;
  pointsTotal: number;
  /** Últimos 7 días, del más antiguo a hoy. */
  days: DayPoints[];
  lastDay: string | null;
  week: { cards: number; cardsKnown: number; quizzes: number; quizAvg: number | null; exams: number; examAvg: number | null; explains: number };
};

const WEEKDAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function shift(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

export function getStats(profileId: number, now = new Date()): Stats {
  const db = getDb();
  const perDay = new Map(
    (
      db
        .prepare('SELECT day, SUM(points) AS points FROM activity WHERE profile_id = ? GROUP BY day')
        .all(profileId) as { day: string; points: number }[]
    ).map((r) => [r.day, r.points]),
  );

  const today = todayISO(now);
  const studiedToday = perDay.has(today);
  let streak = 0;
  for (let offset = studiedToday ? 0 : -1; perDay.has(todayISO(shift(now, offset))); offset--) streak += 1;

  const days: DayPoints[] = [];
  for (let offset = -6; offset <= 0; offset++) {
    const date = shift(now, offset);
    const day = todayISO(date);
    days.push({ day, label: WEEKDAYS[date.getDay()], points: perDay.get(day) ?? 0, today: offset === 0 });
  }

  const since = days[0].day;
  const w = db
    .prepare(
      `SELECT
         COALESCE(SUM(kind = 'card'), 0) AS cards,
         COALESCE(SUM(kind = 'card' AND value >= 1), 0) AS cardsKnown,
         COALESCE(SUM(kind = 'quiz'), 0) AS quizzes,
         AVG(CASE WHEN kind = 'quiz' THEN value END) AS quizAvg,
         COALESCE(SUM(kind = 'exam'), 0) AS exams,
         AVG(CASE WHEN kind = 'exam' THEN value END) AS examAvg,
         COALESCE(SUM(kind = 'explain'), 0) AS explains
       FROM activity WHERE profile_id = ? AND day >= ?`,
    )
    .get(profileId, since) as Stats['week'];

  const allDays = [...perDay.keys()].sort();
  return {
    streak,
    studiedToday,
    pointsWeek: days.reduce((sum, d) => sum + d.points, 0),
    pointsTotal: [...perDay.values()].reduce((sum, p) => sum + p, 0),
    days,
    lastDay: allDays.at(-1) ?? null,
    week: { ...w },
  };
}
