import { canAccess } from './auth';
import { getDb, type Exam, type Profile, type Stage } from './db';
import { formatScore } from './topics';

/** Notas mínimas para dar por superado cada paso de la ruta. */
export const QUIZ_PASS = 7;
export const EXPLAIN_PASS = 6;
export const EXAM_PASS = 5;

export function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Días que faltan hasta una fecha 'AAAA-MM-DD' (negativo si ya pasó). */
export function daysUntil(date: string, now = new Date()): number {
  const [y, m, d] = date.split('-').map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000);
}

export function countdown(days: number): string {
  if (days < 0) return days === -1 ? 'Fue ayer' : `Fue hace ${-days} días`;
  if (days === 0) return '¡Es hoy!';
  return days === 1 ? 'Es mañana' : `Faltan ${days} días`;
}

export function longDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

export type Step = { key: string; label: string; done: boolean; detail: string; href: string };

/** La ruta de estudio de un tema: seis pasos, del material al simulacro, con lo ya conseguido. */
export function topicSteps(topicId: number): Step[] {
  const s = getDb()
    .prepare(
      `SELECT
         EXISTS (SELECT 1 FROM materials WHERE topic_id = :t AND status IN ('text', 'pending_ai')) AS material,
         EXISTS (SELECT 1 FROM topic_notes WHERE topic_id = :t AND intro IS NOT NULL) AS notes,
         (SELECT COUNT(*) FROM flashcards WHERE topic_id = :t) AS cards,
         (SELECT COUNT(*) FROM flashcards WHERE topic_id = :t AND reps > 0) AS studied,
         (SELECT MAX(a.score) FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
           WHERE q.topic_id = :t AND q.kind = 'quiz' AND a.status = 'done') AS quiz,
         (SELECT MAX(score) FROM explanations WHERE topic_id = :t AND status = 'done') AS explain,
         (SELECT MAX(a.score) FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
           WHERE q.topic_id = :t AND q.kind = 'exam' AND a.status = 'done') AS exam`,
    )
    .get({ t: topicId }) as {
    material: number;
    notes: number;
    cards: number;
    studied: number;
    quiz: number | null;
    explain: number | null;
    exam: number | null;
  };
  const best = (score: number | null) => (score === null ? 'Sin hacer' : `Mejor nota: ${formatScore(score)}`);
  const base = `/tema/${topicId}`;
  return [
    { key: 'material', label: 'Subir el material', done: Boolean(s.material), detail: s.material ? 'Hecho' : 'Sin material', href: base },
    { key: 'notes', label: 'Crear y leer el resumen', done: Boolean(s.notes), detail: s.notes ? 'Hecho' : 'Sin resumen', href: base },
    {
      key: 'cards',
      label: 'Estudiar todas las tarjetas',
      done: s.cards > 0 && s.studied === s.cards,
      detail: s.cards === 0 ? 'Sin tarjetas' : `${s.studied} de ${s.cards} estudiadas`,
      href: `${base}/tarjetas`,
    },
    {
      key: 'quiz',
      label: `Quiz rápido con un ${QUIZ_PASS} o más`,
      done: (s.quiz ?? 0) >= QUIZ_PASS,
      detail: best(s.quiz),
      href: `${base}/tests`,
    },
    {
      key: 'explain',
      label: `Explicarlo con tus palabras (${EXPLAIN_PASS} o más)`,
      done: (s.explain ?? 0) >= EXPLAIN_PASS,
      detail: best(s.explain),
      href: `${base}/explicar`,
    },
    {
      key: 'exam',
      label: 'Aprobar un simulacro',
      done: (s.exam ?? 0) >= EXAM_PASS,
      detail: best(s.exam),
      href: `${base}/tests`,
    },
  ];
}

export type ExamRow = Exam & { subject: string; color: string; stage: Stage; profile_id: number; course_active: number };

export function getExamFor(profile: Profile, examId: number): ExamRow | null {
  const exam = getDb()
    .prepare(
      `SELECT e.*, s.name AS subject, s.color, c.stage, c.profile_id, c.active AS course_active
         FROM exams e JOIN subjects s ON s.id = e.subject_id JOIN courses c ON c.id = s.course_id
        WHERE e.id = ?`,
    )
    .get(examId) as ExamRow | undefined;
  return exam && canAccess(profile, exam.profile_id) ? exam : null;
}

export type ExamTopic = { id: number; title: string; steps: Step[] };

export function examTopics(examId: number): ExamTopic[] {
  const topics = getDb()
    .prepare(
      `SELECT t.id, t.title FROM exam_topics x JOIN topics t ON t.id = x.topic_id
        WHERE x.exam_id = ? ORDER BY t.position, t.id`,
    )
    .all(examId) as { id: number; title: string }[];
  return topics.map((t) => ({ id: t.id, title: t.title, steps: topicSteps(t.id) }));
}

export function examProgress(topics: ExamTopic[]): { done: number; total: number; percent: number } {
  const steps = topics.flatMap((t) => t.steps);
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, percent: steps.length ? Math.round((done / steps.length) * 100) : 0 };
}

export type ExamSummary = { id: number; title: string; date: string; subject: string; color: string; days: number; percent: number };

/** Exámenes de un alumno (o de una asignatura), del más cercano al más lejano. Los pasados solo si se piden. */
export function listExams(opts: { profileId?: number; subjectId?: number; includePast?: boolean }): ExamSummary[] {
  const rows = getDb()
    .prepare(
      `SELECT e.id, e.title, e.date, s.name AS subject, s.color
         FROM exams e JOIN subjects s ON s.id = e.subject_id JOIN courses c ON c.id = s.course_id
        WHERE (:p IS NULL OR (c.profile_id = :p AND c.active = 1)) AND (:s IS NULL OR e.subject_id = :s)
        ORDER BY e.date, e.id`,
    )
    .all({ p: opts.profileId ?? null, s: opts.subjectId ?? null }) as Omit<ExamSummary, 'days' | 'percent'>[];
  return rows
    .map((r) => ({
      id: r.id,
      title: r.title,
      date: r.date,
      subject: r.subject,
      color: r.color,
      days: daysUntil(r.date),
      percent: examProgress(examTopics(r.id)).percent,
    }))
    .filter((e) => opts.includePast || e.days >= 0);
}
