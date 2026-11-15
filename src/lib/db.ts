import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export type Role = 'student' | 'parent';
export type Stage = 'primaria' | 'eso' | 'bachillerato' | 'otro';

export type Profile = {
  id: number;
  name: string;
  role: Role;
  color: string;
  pin_hash: string | null;
};

export type Course = {
  id: number;
  profile_id: number;
  name: string;
  stage: Stage;
  school_year: string;
  active: number;
};

export type Subject = { id: number; course_id: number; name: string; color: string };
export type Topic = { id: number; subject_id: number; title: string; position: number };

export const STAGE_LABELS: Record<Stage, string> = {
  primaria: 'Primaria',
  eso: 'ESO',
  bachillerato: 'Bachillerato',
  otro: 'Otro',
};

export const COLORS = ['#4f6df5', '#e8590c', '#2f9e44', '#ae3ec9', '#0c8599', '#e03131', '#f08c00', '#5f3dc4'];

export const SUGGESTED_SUBJECTS: Record<Stage, string[]> = {
  primaria: [
    'Matemáticas',
    'Lengua Castellana',
    'Inglés',
    'Ciencias de la Naturaleza',
    'Ciencias Sociales',
    'Educación Artística',
    'Música',
    'Educación Física',
  ],
  eso: [
    'Matemáticas',
    'Lengua Castellana y Literatura',
    'Inglés',
    'Geografía e Historia',
    'Física y Química',
    'Biología y Geología',
    'Tecnología',
    'Economía',
    'Francés',
    'Educación Física',
  ],
  bachillerato: ['Matemáticas', 'Lengua Castellana y Literatura', 'Inglés', 'Filosofía', 'Historia', 'Física', 'Química', 'Biología'],
  otro: [],
};

/** Curso escolar en vigor, p. ej. "2026-2027" (cambia en agosto). */
export function currentSchoolYear(now = new Date()): string {
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

export function nextSchoolYear(schoolYear: string): string {
  const m = /^(\d{4})-(\d{4})$/.exec(schoolYear);
  if (!m) return currentSchoolYear();
  return `${Number(m[1]) + 1}-${Number(m[2]) + 1}`;
}

/** Propone el curso siguiente: 6º Primaria → 1º ESO, 4º ESO → 1º Bachillerato… */
export function suggestNextCourse(course: Pick<Course, 'name' | 'stage'>): { name: string; stage: Stage } {
  const m = /^(\d)\s*º/.exec(course.name);
  const n = m ? Number(m[1]) : 0;
  const last: Record<Stage, number> = { primaria: 6, eso: 4, bachillerato: 2, otro: 0 };
  const following: Record<Stage, Stage> = { primaria: 'eso', eso: 'bachillerato', bachillerato: 'otro', otro: 'otro' };
  if (!n || course.stage === 'otro') return { name: '', stage: course.stage };
  if (n < last[course.stage]) return { name: `${n + 1}º ${STAGE_LABELS[course.stage]}`, stage: course.stage };
  const stage = following[course.stage];
  return stage === 'otro' ? { name: '', stage } : { name: `1º ${STAGE_LABELS[stage]}`, stage };
}

export type MaterialKind = 'pdf' | 'image' | 'text';
/** text: ya tiene texto · pending_ai: foto o PDF escaneado, lo leerá la IA · error: no se pudo leer */
export type MaterialStatus = 'text' | 'pending_ai' | 'reading' | 'error';

/** Tarjeta de estudio con su estado de repetición espaciada. due_at = 0 significa "nueva". */
export type Flashcard = {
  id: number;
  topic_id: number;
  front: string;
  back: string;
  source: 'ai' | 'manual';
  due_at: number;
  interval_days: number;
  ease: number;
  reps: number;
  lapses: number;
};

/** Trabajo de IA en segundo plano de un tema (p. ej. kind = 'cards'). */
export type TopicJob = { topic_id: number; kind: string; status: 'running' | 'done' | 'error'; step: string | null; error: string | null };

/** Examen real del colegio, con fecha y los temas que entran. date es 'AAAA-MM-DD'. */
export type Exam = { id: number; subject_id: number; title: string; date: string };

/** Lo que devuelve la IA al revisar una explicación del alumno. */
export type ExplanationResult = { understood: string[]; missing: string[]; mistakes: string[]; tip: string };

/** "Explícalo con tus palabras": el alumno cuenta el tema y la IA le dice qué domina y qué le falta. */
export type Explanation = {
  id: number;
  topic_id: number;
  text: string;
  status: 'grading' | 'done' | 'error';
  result: string | null;
  /** Comprensión del tema, de 0 a 10. */
  score: number | null;
  error: string | null;
  created_at: string;
};

/** Mensaje del chat con el tutor de un tema. pending: la IA aún está escribiendo la respuesta. */
export type ChatMessage = {
  id: number;
  topic_id: number;
  role: 'user' | 'assistant';
  content: string;
  status: 'done' | 'pending' | 'error';
  created_at: string;
};

export type QuizKind = 'quiz' | 'exam';

/** Pregunta de test (choice) o de respuesta escrita (open). */
export type Question = {
  type: 'choice' | 'open';
  question: string;
  /** Opciones de una pregunta tipo test; vacío en las abiertas. */
  options: string[];
  /** Índice de la opción correcta; -1 en las abiertas. */
  correct_index: number;
  hint: string;
  /** Tipo test: por qué es correcta. Abierta: respuesta modelo. */
  explanation: string;
  points: number;
};

/** Respuesta del alumno: índice de opción, texto escrito, o null si la dejó en blanco. */
export type Answer = number | string | null;

/** Corrección de una pregunta. */
export type QuestionResult = { earned: number; feedback: string };

export type Quiz = {
  id: number;
  topic_id: number;
  kind: QuizKind;
  status: 'generating' | 'ready' | 'error';
  step: string | null;
  error: string | null;
  questions: string | null;
  minutes: number;
  created_at: string;
};

export type QuizAttempt = {
  id: number;
  quiz_id: number;
  status: 'grading' | 'done' | 'error';
  answers: string;
  results: string | null;
  /** Nota sobre 10. */
  score: number | null;
  error: string | null;
  created_at: string;
};

export type NoteSection = { title: string; points: string[] };
export type KeyTerm = { term: string; definition: string };

/** Resumen y términos clave de un tema. sections y key_terms se guardan como JSON. */
export type TopicNotes = {
  topic_id: number;
  status: 'generating' | 'ready' | 'error';
  step: string | null;
  error: string | null;
  intro: string | null;
  sections: string | null;
  key_terms: string | null;
  updated_at: string;
};

export type Material = {
  id: number;
  topic_id: number;
  kind: MaterialKind;
  name: string;
  file: string | null;
  mime: string | null;
  size: number;
  pages: number | null;
  content: string | null;
  status: MaterialStatus;
};

export const DATA_DIR = process.env.DATA_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), 'data');

declare global {
  var __s4kDb: DatabaseSync | undefined;
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student','parent')),
      color TEXT NOT NULL,
      pin_hash TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      stage TEXT NOT NULL,
      school_year TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('pdf','image','text')),
      name TEXT NOT NULL,
      file TEXT,
      mime TEXT,
      size INTEGER NOT NULL DEFAULT 0,
      pages INTEGER,
      content TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS topic_notes (
      topic_id INTEGER PRIMARY KEY REFERENCES topics(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      step TEXT,
      error TEXT,
      intro TEXT,
      sections TEXT,
      key_terms TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS flashcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      due_at INTEGER NOT NULL DEFAULT 0,
      interval_days REAL NOT NULL DEFAULT 0,
      ease REAL NOT NULL DEFAULT 2.5,
      reps INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0,
      last_reviewed INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS flashcards_topic ON flashcards(topic_id);
    CREATE TABLE IF NOT EXISTS topic_jobs (
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      step TEXT,
      error TEXT,
      PRIMARY KEY (topic_id, kind)
    );
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('quiz','exam')),
      status TEXT NOT NULL,
      step TEXT,
      error TEXT,
      questions TEXT,
      minutes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      answers TEXT NOT NULL,
      results TEXT,
      score REAL,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS exam_topics (
      exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      PRIMARY KEY (exam_id, topic_id)
    );
    CREATE TABLE IF NOT EXISTS explanations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      status TEXT NOT NULL,
      result TEXT,
      score REAL,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user','assistant')),
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'done',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS chat_topic ON chat_messages(topic_id, id);
    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      kind TEXT NOT NULL,
      points INTEGER NOT NULL,
      value REAL,
      topic_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS activity_profile_day ON activity(profile_id, day);
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
  `);
}

/** Una instalación nueva no tiene perfiles: los crea cada familia en la pantalla de primera configuración. */
export function isSetUp(): boolean {
  const { n } = getDb().prepare('SELECT COUNT(*) AS n FROM profiles').get() as { n: number };
  return n > 0;
}

export const MAX_SETUP_CHILDREN = 6;

export function getDb(): DatabaseSync {
  if (!globalThis.__s4kDb) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const db = new DatabaseSync(path.join(DATA_DIR, 'studies4kids.db'));
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    migrate(db);
    // Los trabajos de IA viven en memoria: si el servidor se reinició a medias, quedaron colgados.
    db.exec(`
      UPDATE topic_notes SET status = 'error', step = NULL,
             error = 'Se interrumpió al reiniciar la app. Vuelve a intentarlo.'
       WHERE status = 'generating';
      UPDATE materials SET status = 'pending_ai' WHERE status = 'reading';
      UPDATE topic_jobs SET status = 'error', step = NULL,
             error = 'Se interrumpió al reiniciar la app. Vuelve a intentarlo.'
       WHERE status = 'running';
      UPDATE quizzes SET status = 'error', step = NULL,
             error = 'Se interrumpió al reiniciar la app. Bórralo y crea otro.'
       WHERE status = 'generating';
      UPDATE quiz_attempts SET status = 'error',
             error = 'La corrección se interrumpió al reiniciar la app.'
       WHERE status = 'grading';
      UPDATE chat_messages SET status = 'error',
             content = 'La respuesta se interrumpió al reiniciar la app. Vuelve a preguntar.'
       WHERE status = 'pending';
      UPDATE explanations SET status = 'error',
             error = 'La revisión se interrumpió al reiniciar la app.'
       WHERE status = 'grading';
    `);
    globalThis.__s4kDb = db;
  }
  return globalThis.__s4kDb;
}
