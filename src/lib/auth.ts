import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, type Profile } from './db';

const COOKIE = 's4k_session';
const SESSION_DAYS = 30;

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(pin, salt, 32).toString('hex')}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

// Freno a probar PIN al azar: 5 fallos seguidos bloquean el perfil 1 minuto.
declare global {
  var __s4kFails: Map<number, { count: number; until: number }> | undefined;
}
const fails = (globalThis.__s4kFails ??= new Map());

export function lockedSeconds(profileId: number): number {
  const f = fails.get(profileId);
  return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 1000) : 0;
}

export function registerFail(profileId: number) {
  const f = fails.get(profileId) ?? { count: 0, until: 0 };
  f.count += 1;
  if (f.count >= 5) {
    f.count = 0;
    f.until = Date.now() + 60_000;
  }
  fails.set(profileId, f);
}

export function clearFails(profileId: number) {
  fails.delete(profileId);
}

export async function createSession(profileId: number) {
  const token = randomBytes(32).toString('hex');
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token, profile_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    profileId,
    Date.now() + maxAge * 1000,
  );
  // Sin "secure": la app se sirve por http dentro de la red de casa.
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
  jar.delete(COOKIE);
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT p.id, p.name, p.role, p.color, p.pin_hash
         FROM sessions s JOIN profiles p ON p.id = s.profile_id
        WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, Date.now()) as Profile | undefined;
  return row ?? null;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/');
  return profile;
}

export async function requireStudent(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== 'student') redirect('/padres');
  return profile;
}

export async function requireParent(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== 'parent') redirect('/inicio');
  return profile;
}

export function canAccess(profile: Profile, ownerId: number): boolean {
  return profile.role === 'parent' || profile.id === ownerId;
}

export function courseOwner(courseId: number): number | null {
  const r = getDb().prepare('SELECT profile_id FROM courses WHERE id = ?').get(courseId) as
    | { profile_id: number }
    | undefined;
  return r?.profile_id ?? null;
}

export function subjectOwner(subjectId: number): number | null {
  const r = getDb()
    .prepare('SELECT c.profile_id FROM subjects s JOIN courses c ON c.id = s.course_id WHERE s.id = ?')
    .get(subjectId) as { profile_id: number } | undefined;
  return r?.profile_id ?? null;
}

export function materialOwner(materialId: number): number | null {
  const r = getDb()
    .prepare(
      `SELECT c.profile_id FROM materials m
         JOIN topics t ON t.id = m.topic_id
         JOIN subjects s ON s.id = t.subject_id
         JOIN courses c ON c.id = s.course_id
        WHERE m.id = ?`,
    )
    .get(materialId) as { profile_id: number } | undefined;
  return r?.profile_id ?? null;
}

export function quizOwner(quizId: number): number | null {
  const r = getDb()
    .prepare(
      `SELECT c.profile_id FROM quizzes q
         JOIN topics t ON t.id = q.topic_id
         JOIN subjects s ON s.id = t.subject_id
         JOIN courses c ON c.id = s.course_id
        WHERE q.id = ?`,
    )
    .get(quizId) as { profile_id: number } | undefined;
  return r?.profile_id ?? null;
}

export function attemptOwner(attemptId: number): number | null {
  const r = getDb().prepare('SELECT quiz_id FROM quiz_attempts WHERE id = ?').get(attemptId) as
    | { quiz_id: number }
    | undefined;
  return r ? quizOwner(r.quiz_id) : null;
}

export function examOwner(examId: number): number | null {
  const r = getDb().prepare('SELECT subject_id FROM exams WHERE id = ?').get(examId) as { subject_id: number } | undefined;
  return r ? subjectOwner(r.subject_id) : null;
}

export function cardOwner(cardId: number): number | null {
  const r = getDb()
    .prepare(
      `SELECT c.profile_id FROM flashcards f
         JOIN topics t ON t.id = f.topic_id
         JOIN subjects s ON s.id = t.subject_id
         JOIN courses c ON c.id = s.course_id
        WHERE f.id = ?`,
    )
    .get(cardId) as { profile_id: number } | undefined;
  return r?.profile_id ?? null;
}

export function topicOwner(topicId: number): number | null {
  const r = getDb()
    .prepare(
      `SELECT c.profile_id FROM topics t
         JOIN subjects s ON s.id = t.subject_id
         JOIN courses c ON c.id = s.course_id
        WHERE t.id = ?`,
    )
    .get(topicId) as { profile_id: number } | undefined;
  return r?.profile_id ?? null;
}
