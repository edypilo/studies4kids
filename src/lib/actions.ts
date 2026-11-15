'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  COLORS,
  MAX_SETUP_CHILDREN,
  STAGE_LABELS,
  currentSchoolYear,
  getDb,
  type Answer,
  type Profile,
  type Stage,
} from './db';
import {
  attemptOwner,
  canAccess,
  cardOwner,
  quizOwner,
  clearFails,
  courseOwner,
  createSession,
  examOwner,
  destroySession,
  hashPin,
  lockedSeconds,
  materialOwner,
  registerFail,
  requireParent,
  requireProfile,
  subjectOwner,
  topicOwner,
  verifyPin,
} from './auth';

import { MAX_FILES, MAX_TEXT_CHARS, filesOfProfile, filesOfSubject, filesOfTopic, removeFiles, saveUpload } from './materials';

import { aiReady, generateJson, getSetting, setSetting } from './ai';
import { logActivity, logLearnSession } from './progress';
import { retryGrading, startExplanation, startQuiz, submitAttempt } from './quiz';
import { schedule, type Grade, type SrsState } from './srs';
import { startTopicCards, startTopicNotes } from './study';
import { MAX_QUESTION_CHARS, askTutor } from './tutor';

export type LoginState = { error: string };

function text(fd: FormData, key: string, max = 80): string {
  return String(fd.get(key) ?? '')
    .trim()
    .slice(0, max);
}

function stageOf(fd: FormData): Stage {
  const s = text(fd, 'stage');
  return s in STAGE_LABELS ? (s as Stage) : 'otro';
}

function schoolYearOf(fd: FormData): string {
  const y = text(fd, 'school_year');
  return /^\d{4}-\d{4}$/.test(y) ? y : currentSchoolYear();
}

export async function loginAction(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const id = Number(fd.get('profileId'));
  const pin = String(fd.get('pin') ?? '');
  const db = getDb();
  const profile = db.prepare('SELECT id, name, role, color, pin_hash FROM profiles WHERE id = ?').get(id) as
    | Profile
    | undefined;
  if (!profile) return { error: 'Perfil no encontrado.' };
  if (!/^\d{4,8}$/.test(pin)) return { error: 'El PIN debe tener entre 4 y 8 números.' };

  if (!profile.pin_hash) {
    if (pin !== String(fd.get('pin2') ?? '')) return { error: 'Los dos PIN no coinciden.' };
    db.prepare('UPDATE profiles SET pin_hash = ? WHERE id = ?').run(hashPin(pin), id);
  } else {
    const wait = lockedSeconds(id);
    if (wait > 0) return { error: `Demasiados intentos. Espera ${wait} segundos.` };
    if (!verifyPin(pin, profile.pin_hash)) {
      registerFail(id);
      return { error: 'PIN incorrecto.' };
    }
    clearFails(id);
  }

  await createSession(id);
  redirect(profile.role === 'parent' ? '/padres' : '/inicio');
}

export async function logoutAction() {
  await destroySession();
  redirect('/');
}

export async function addSubject(fd: FormData) {
  const me = await requireProfile();
  const courseId = Number(fd.get('courseId'));
  const name = text(fd, 'name');
  const owner = courseOwner(courseId);
  if (!name || owner === null || !canAccess(me, owner)) return;
  const db = getDb();
  const existing = db.prepare('SELECT name FROM subjects WHERE course_id = ?').all(courseId) as { name: string }[];
  if (existing.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;
  db.prepare('INSERT INTO subjects (course_id, name, color) VALUES (?, ?, ?)').run(
    courseId,
    name,
    COLORS[existing.length % COLORS.length],
  );
  revalidatePath('/inicio');
}

export async function deleteSubject(fd: FormData) {
  const me = await requireProfile();
  const subjectId = Number(fd.get('subjectId'));
  const owner = subjectOwner(subjectId);
  if (owner === null || !canAccess(me, owner)) return;
  const files = filesOfSubject(subjectId);
  getDb().prepare('DELETE FROM subjects WHERE id = ?').run(subjectId);
  await removeFiles(files);
  redirect('/inicio');
}

export async function addTopic(fd: FormData) {
  const me = await requireProfile();
  const subjectId = Number(fd.get('subjectId'));
  const title = text(fd, 'title', 120);
  const owner = subjectOwner(subjectId);
  if (!title || owner === null || !canAccess(me, owner)) return;
  const db = getDb();
  const { next } = db
    .prepare('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM topics WHERE subject_id = ?')
    .get(subjectId) as { next: number };
  db.prepare('INSERT INTO topics (subject_id, title, position) VALUES (?, ?, ?)').run(subjectId, title, next);
  revalidatePath(`/asignatura/${subjectId}`);
}

export async function deleteTopic(fd: FormData) {
  const me = await requireProfile();
  const topicId = Number(fd.get('topicId'));
  const owner = topicOwner(topicId);
  if (owner === null || !canAccess(me, owner)) return;
  const db = getDb();
  const row = db.prepare('SELECT subject_id FROM topics WHERE id = ?').get(topicId) as { subject_id: number };
  const files = filesOfTopic(topicId);
  db.prepare('DELETE FROM topics WHERE id = ?').run(topicId);
  await removeFiles(files);
  redirect(`/asignatura/${row.subject_id}`);
}

export type UploadState = { errors: string[]; saved: number };

export async function uploadMaterial(_prev: UploadState, fd: FormData): Promise<UploadState> {
  const me = await requireProfile();
  const topicId = Number(fd.get('topicId'));
  const owner = topicOwner(topicId);
  if (owner === null || !canAccess(me, owner)) return { errors: ['No se encuentra el tema.'], saved: 0 };

  const files = fd.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { errors: ['Elige al menos un archivo.'], saved: 0 };
  if (files.length > MAX_FILES) return { errors: [`Como máximo ${MAX_FILES} archivos cada vez.`], saved: 0 };

  const errors: string[] = [];
  let saved = 0;
  for (const file of files) {
    const error = await saveUpload(topicId, file);
    if (error) errors.push(error);
    else saved += 1;
  }
  revalidatePath(`/tema/${topicId}`);
  return { errors, saved };
}

export async function addTextMaterial(fd: FormData) {
  const me = await requireProfile();
  const topicId = Number(fd.get('topicId'));
  const owner = topicOwner(topicId);
  const content = String(fd.get('content') ?? '')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
  if (!content || owner === null || !canAccess(me, owner)) return;
  getDb()
    .prepare("INSERT INTO materials (topic_id, kind, name, size, content, status) VALUES (?, 'text', ?, ?, ?, 'text')")
    .run(topicId, text(fd, 'name', 150) || 'Texto pegado', Buffer.byteLength(content), content);
  revalidatePath(`/tema/${topicId}`);
}

/** Lee las fotos pendientes y crea (o rehace) el resumen y los términos clave del tema. */
export async function generateNotes(fd: FormData) {
  const me = await requireProfile();
  const topicId = Number(fd.get('topicId'));
  const owner = topicOwner(topicId);
  if (owner === null || !canAccess(me, owner) || !aiReady()) return;
  startTopicNotes(topicId);
  revalidatePath(`/tema/${topicId}`);
}

/** Crea tarjetas con IA a partir del material del tema (añade a las que ya haya). */
export async function generateCards(fd: FormData) {
  const me = await requireProfile();
  const topicId = Number(fd.get('topicId'));
  const owner = topicOwner(topicId);
  if (owner === null || !canAccess(me, owner) || !aiReady()) return;
  startTopicCards(topicId);
  revalidatePath(`/tema/${topicId}/tarjetas`);
}

export async function addCard(fd: FormData) {
  const me = await requireProfile();
  const topicId = Number(fd.get('topicId'));
  const owner = topicOwner(topicId);
  const front = text(fd, 'front', 500);
  const back = text(fd, 'back', 1000);
  if (!front || !back || owner === null || !canAccess(me, owner)) return;
  getDb().prepare("INSERT INTO flashcards (topic_id, front, back, source) VALUES (?, ?, ?, 'manual')").run(topicId, front, back);
  revalidatePath(`/tema/${topicId}/tarjetas`);
}

export async function deleteCard(fd: FormData) {
  const me = await requireProfile();
  const cardId = Number(fd.get('cardId'));
  const owner = cardOwner(cardId);
  if (owner === null || !canAccess(me, owner)) return;
  const db = getDb();
  const row = db.prepare('SELECT topic_id FROM flashcards WHERE id = ?').get(cardId) as { topic_id: number };
  db.prepare('DELETE FROM flashcards WHERE id = ?').run(cardId);
  revalidatePath(`/tema/${row.topic_id}/tarjetas`);
}

/** Guarda la respuesta de un repaso y programa la próxima vez. Solo cuenta si repasa el propio alumno. */
export async function gradeCard(cardId: number, grade: Grade) {
  const me = await requireProfile();
  if (cardOwner(cardId) !== me.id || !['again', 'hard', 'good'].includes(grade)) return;
  const db = getDb();
  const card = db.prepare('SELECT interval_days, ease, reps, lapses FROM flashcards WHERE id = ?').get(cardId) as SrsState;
  const next = schedule(card, grade);
  db.prepare(
    'UPDATE flashcards SET interval_days = ?, ease = ?, reps = ?, lapses = ?, due_at = ?, last_reviewed = ? WHERE id = ?',
  ).run(next.interval_days, next.ease, next.reps, next.lapses, next.due_at, Date.now(), cardId);
  const { topic_id } = db.prepare('SELECT topic_id FROM flashcards WHERE id = ?').get(cardId) as { topic_id: number };
  logActivity(me.id, 'card', 1, grade === 'good' ? 1 : grade === 'hard' ? 0.5 : 0, topic_id);
}

/** Apunta una ronda de "Aprender" terminada (cuenta para la racha y da unos pocos puntos). */
export async function finishLearnSession(cards: number) {
  const me = await requireProfile();
  if (me.role !== 'student' || !Number.isInteger(cards)) return;
  logLearnSession(me.id, cards);
}

/** Crea con IA un quiz rápido o un simulacro del tema. */
export async function createQuiz(fd: FormData) {
  const me = await requireProfile();
  const topicId = Number(fd.get('topicId'));
  const kind = fd.get('kind') === 'exam' ? 'exam' : 'quiz';
  const owner = topicOwner(topicId);
  if (owner === null || !canAccess(me, owner) || !aiReady()) return;
  startQuiz(topicId, kind);
  revalidatePath(`/tema/${topicId}/tests`);
}

export async function deleteQuiz(fd: FormData) {
  const me = await requireProfile();
  const quizId = Number(fd.get('quizId'));
  const owner = quizOwner(quizId);
  if (owner === null || !canAccess(me, owner)) return;
  const db = getDb();
  const row = db.prepare('SELECT topic_id FROM quizzes WHERE id = ?').get(quizId) as { topic_id: number };
  db.prepare('DELETE FROM quizzes WHERE id = ?').run(quizId);
  revalidatePath(`/tema/${row.topic_id}/tests`);
}

/**
 * Entrega un quiz o un simulacro. Devuelve el id del intento, o null si no se guarda
 * (solo cuentan los intentos del propio alumno, no los de los padres curioseando).
 */
export async function submitQuiz(quizId: number, answers: Answer[]): Promise<number | null> {
  const me = await requireProfile();
  if (quizOwner(quizId) !== me.id || !Array.isArray(answers)) return null;
  const quiz = getDb().prepare('SELECT status FROM quizzes WHERE id = ?').get(quizId) as { status: string };
  if (quiz.status !== 'ready') return null;
  return submitAttempt(quizId, answers);
}

export async function regradeAttempt(fd: FormData) {
  const me = await requireProfile();
  const attemptId = Number(fd.get('attemptId'));
  const owner = attemptOwner(attemptId);
  if (owner === null || !canAccess(me, owner) || !aiReady()) return;
  retryGrading(attemptId);
  revalidatePath(`/intento/${attemptId}`);
}

/** Apunta un examen del colegio: asignatura, fecha y temas que entran. */
export async function createExam(fd: FormData) {
  const me = await requireProfile();
  const subjectId = Number(fd.get('subjectId'));
  const owner = subjectOwner(subjectId);
  const date = text(fd, 'date', 10);
  if (owner === null || !canAccess(me, owner) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const db = getDb();
  // Solo valen temas de esa misma asignatura.
  const valid = new Set(
    (db.prepare('SELECT id FROM topics WHERE subject_id = ?').all(subjectId) as { id: number }[]).map((t) => t.id),
  );
  const topicIds = [...new Set(fd.getAll('topics').map(Number))].filter((id) => valid.has(id));
  if (topicIds.length === 0) return;

  const examId = Number(
    db
      .prepare('INSERT INTO exams (subject_id, title, date) VALUES (?, ?, ?)')
      .run(subjectId, text(fd, 'title', 80) || 'Examen', date).lastInsertRowid,
  );
  const link = db.prepare('INSERT INTO exam_topics (exam_id, topic_id) VALUES (?, ?)');
  for (const topicId of topicIds) link.run(examId, topicId);
  redirect(`/examen/${examId}`);
}

export async function deleteExam(fd: FormData) {
  const me = await requireProfile();
  const examId = Number(fd.get('examId'));
  const owner = examOwner(examId);
  if (owner === null || !canAccess(me, owner)) return;
  const db = getDb();
  const row = db.prepare('SELECT subject_id FROM exams WHERE id = ?').get(examId) as { subject_id: number };
  db.prepare('DELETE FROM exams WHERE id = ?').run(examId);
  redirect(`/asignatura/${row.subject_id}`);
}

export type ExplainState = { error: string };

/** "Explícalo con tus palabras": guarda la explicación y lanza la revisión de la IA. */
export async function submitExplanation(_prev: ExplainState, fd: FormData): Promise<ExplainState> {
  const me = await requireProfile();
  const topicId = Number(fd.get('topicId'));
  if (topicOwner(topicId) !== me.id) return { error: 'Solo puede hacerlo el alumno desde su perfil.' };
  if (!aiReady()) return { error: 'La IA no está conectada.' };
  const explanation = text(fd, 'text', 6000);
  if (explanation.length < 40) return { error: 'Escribe un poco más: cuenta todo lo que recuerdes del tema.' };
  startExplanation(topicId, explanation);
  revalidatePath(`/tema/${topicId}/explicar`);
  return { error: '' };
}

/** Envía una pregunta al tutor del tema. Solo el propio alumno puede escribir; los padres solo leen. */
export async function sendTutorMessage(fd: FormData) {
  const me = await requireProfile();
  const topicId = Number(fd.get('topicId'));
  const question = text(fd, 'message', MAX_QUESTION_CHARS);
  if (topicOwner(topicId) !== me.id || !question || !aiReady()) return;
  askTutor(topicId, question);
  revalidatePath(`/tema/${topicId}/tutor`);
}

/** Borra la conversación con el tutor. Solo los padres, para que siempre puedan revisarla. */
export async function clearTutorChat(fd: FormData) {
  await requireParent();
  const topicId = Number(fd.get('topicId'));
  getDb().prepare("DELETE FROM chat_messages WHERE topic_id = ? AND status != 'pending'").run(topicId);
  revalidatePath(`/tema/${topicId}/tutor`);
}

export async function saveAiSettings(fd: FormData) {
  await requireParent();
  const provider = text(fd, 'provider');
  setSetting('ai_provider', provider === 'codex' || provider === 'openai' ? provider : 'none');
  setSetting('openai_model', text(fd, 'openai_model', 60));
  setSetting('codex_model', text(fd, 'codex_model', 60));
  // La clave solo se cambia si se escribe una nueva; el campo vacío conserva la guardada.
  const key = text(fd, 'openai_key', 300);
  if (key) setSetting('openai_key', key);
  if (fd.get('forget_key') === 'on') setSetting('openai_key', '');
  revalidatePath('/padres');
}

export type AiTestState = { ok: boolean; message: string };

export async function testAi(_prev: AiTestState, _fd: FormData): Promise<AiTestState> {
  await requireParent();
  try {
    const { saludo } = await generateJson<{ saludo: string }>({
      instructions: 'Responde con un saludo muy breve en español para comprobar que la conexión funciona.',
      input: 'Saluda.',
      schemaName: 'prueba',
      schema: {
        type: 'object',
        properties: { saludo: { type: 'string' } },
        required: ['saludo'],
        additionalProperties: false,
      },
    });
    return { ok: true, message: `Funciona. La IA responde: "${saludo.slice(0, 120)}"` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Error desconocido.' };
  }
}

export async function deleteMaterial(fd: FormData) {
  const me = await requireProfile();
  const materialId = Number(fd.get('materialId'));
  const owner = materialOwner(materialId);
  if (owner === null || !canAccess(me, owner)) return;
  const db = getDb();
  const row = db.prepare('SELECT topic_id, file FROM materials WHERE id = ?').get(materialId) as {
    topic_id: number;
    file: string | null;
  };
  db.prepare('DELETE FROM materials WHERE id = ?').run(materialId);
  if (row.file) await removeFiles([row.file]);
  revalidatePath(`/tema/${row.topic_id}`);
}

/** Pasar de curso: crea el curso nuevo como activo y deja los anteriores archivados. */
export async function startNewCourse(fd: FormData) {
  const me = await requireProfile();
  const profileId = Number(fd.get('profileId'));
  const name = text(fd, 'name', 40);
  if (!name || !canAccess(me, profileId)) return;
  const db = getDb();
  const target = db.prepare("SELECT id FROM profiles WHERE id = ? AND role = 'student'").get(profileId);
  if (!target) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE courses SET active = 0 WHERE profile_id = ?').run(profileId);
    db.prepare('INSERT INTO courses (profile_id, name, stage, school_year, active) VALUES (?, ?, ?, ?, 1)').run(
      profileId,
      name,
      stageOf(fd),
      schoolYearOf(fd),
    );
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  revalidatePath('/padres');
  if (me.role === 'student') redirect('/inicio');
}

export async function addStudent(fd: FormData) {
  await requireParent();
  const name = text(fd, 'name', 30);
  const courseName = text(fd, 'course', 40);
  if (!name || !courseName) return;
  const db = getDb();
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM profiles WHERE role = 'student'").get() as { n: number };
  const id = db
    .prepare("INSERT INTO profiles (name, role, color) VALUES (?, 'student', ?)")
    .run(name, COLORS[(n + 1) % COLORS.length]).lastInsertRowid;
  db.prepare('INSERT INTO courses (profile_id, name, stage, school_year, active) VALUES (?, ?, ?, ?, 1)').run(
    id,
    courseName,
    stageOf(fd),
    currentSchoolYear(),
  );
  revalidatePath('/padres');
}

export async function renameStudent(fd: FormData) {
  await requireParent();
  const name = text(fd, 'name', 30);
  if (!name) return;
  getDb().prepare("UPDATE profiles SET name = ? WHERE id = ? AND role = 'student'").run(name, Number(fd.get('profileId')));
  revalidatePath('/padres');
}

/** Borra a un hijo con todo lo suyo: cursos, asignaturas, material, tarjetas, notas y progreso. */
export async function deleteStudent(fd: FormData) {
  await requireParent();
  const profileId = Number(fd.get('profileId'));
  const db = getDb();
  if (!db.prepare("SELECT id FROM profiles WHERE id = ? AND role = 'student'").get(profileId)) return;
  const files = filesOfProfile(profileId);
  db.prepare('DELETE FROM profiles WHERE id = ?').run(profileId);
  await removeFiles(files);
  revalidatePath('/padres');
}

/**
 * Primera configuración de una instalación nueva: PIN de padres y perfiles de los hijos.
 * Solo funciona mientras no exista ningún perfil.
 */
export async function setupFamily(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const pin = String(fd.get('pin') ?? '');
  if (!/^\d{4,8}$/.test(pin)) return { error: 'El PIN debe tener entre 4 y 8 números.' };
  if (pin !== String(fd.get('pin2') ?? '')) return { error: 'Los dos PIN no coinciden.' };

  const names = fd.getAll('name').map((v) => String(v).trim().slice(0, 30));
  const courses = fd.getAll('course').map((v) => String(v).trim().slice(0, 40));
  const stages = fd.getAll('stage').map((v) => String(v));
  const children = names
    .map((name, i) => ({ name, course: courses[i] ?? '', stage: (stages[i] ?? '') in STAGE_LABELS ? (stages[i] as Stage) : 'otro' }))
    .filter((c) => c.name || c.course)
    .slice(0, MAX_SETUP_CHILDREN);
  if (children.length === 0) return { error: 'Añade al menos un hijo.' };
  if (children.some((c) => !c.name || !c.course)) return { error: 'Cada hijo necesita nombre y curso.' };

  const db = getDb();
  let parentId: number | bigint;
  db.exec('BEGIN IMMEDIATE');
  try {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM profiles').get() as { n: number };
    if (n > 0) {
      db.exec('ROLLBACK');
      redirect('/');
    }
    parentId = db
      .prepare("INSERT INTO profiles (name, role, color, pin_hash) VALUES ('Padres', 'parent', '#495057', ?)")
      .run(hashPin(pin)).lastInsertRowid;
    const addProfile = db.prepare("INSERT INTO profiles (name, role, color) VALUES (?, 'student', ?)");
    const addCourse = db.prepare('INSERT INTO courses (profile_id, name, stage, school_year, active) VALUES (?, ?, ?, ?, 1)');
    const year = currentSchoolYear();
    children.forEach((c, i) => {
      const id = addProfile.run(c.name, COLORS[i % COLORS.length]).lastInsertRowid;
      addCourse.run(id, c.course, c.stage, year);
    });
    db.exec('COMMIT');
  } catch (e) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw e;
  }
  // La vía habitual es la cuenta de ChatGPT mediante Codex: se deja elegida para que solo falte probarla.
  if (!getSetting('ai_provider')) setSetting('ai_provider', 'codex');
  await createSession(Number(parentId));
  redirect('/padres');
}

/** Borra el PIN de un hijo y cierra sus sesiones: elegirá uno nuevo al entrar. */
export async function resetPin(fd: FormData) {
  await requireParent();
  const profileId = Number(fd.get('profileId'));
  const db = getDb();
  const changed = db
    .prepare("UPDATE profiles SET pin_hash = NULL WHERE id = ? AND role = 'student'")
    .run(profileId).changes;
  if (changed) db.prepare('DELETE FROM sessions WHERE profile_id = ?').run(profileId);
  revalidatePath('/padres');
}
