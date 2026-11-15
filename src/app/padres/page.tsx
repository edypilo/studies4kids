import { ConfirmButton } from '@/components/ConfirmButton';
import { NewCourseForm } from '@/components/NewCourseForm';
import Link from 'next/link';
import { AiTestButton } from '@/components/AiTestButton';
import { countdown, listExams, longDate } from '@/lib/exams';
import { getStats } from '@/lib/progress';
import { addStudent, deleteStudent, renameStudent, resetPin, saveAiSettings } from '@/lib/actions';
import { aiReady, codexStatus, getAiSettings } from '@/lib/ai';
import { requireParent } from '@/lib/auth';
import { STAGE_LABELS, getDb, type Course } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Student = { id: number; name: string; color: string; has_pin: number };
type CourseRow = Course & { subjects: number; topics: number };

export default async function ParentPanel() {
  await requireParent();
  const db = getDb();
  const ai = getAiSettings();
  const codex = ai.provider === 'codex' ? await codexStatus() : null;
  const students = db
    .prepare("SELECT id, name, color, pin_hash IS NOT NULL AS has_pin FROM profiles WHERE role = 'student' ORDER BY name")
    .all() as Student[];
  const coursesOf = db.prepare(
    `SELECT c.*,
            (SELECT COUNT(*) FROM subjects s WHERE s.course_id = c.id) AS subjects,
            (SELECT COUNT(*) FROM topics t JOIN subjects s ON s.id = t.subject_id WHERE s.course_id = c.id) AS topics
       FROM courses c WHERE c.profile_id = ? ORDER BY c.active DESC, c.id DESC`,
  );

  return (
    <>
      <h1>Panel de padres</h1>
      <p className="muted">Perfiles de tus hijos, sus cursos y la configuración de la app.</p>

      <h2>Hijos</h2>
      <div className="list">
        {students.map((s) => {
          const courses = coursesOf.all(s.id) as CourseRow[];
          const active = courses.find((c) => c.active) ?? null;
          const stats = getStats(s.id);
          const nextExam = listExams({ profileId: s.id })[0];
          return (
            <div key={s.id} className="card">
              <div className="row between">
                <div className="row">
                  <span className="avatar small" style={{ background: s.color }}>
                    {s.name[0]}
                  </span>
                  <strong>{s.name}</strong>
                  <span className={s.has_pin ? 'badge' : 'badge off'}>{s.has_pin ? 'PIN creado' : 'Sin PIN todavía'}</span>
                </div>
                {s.has_pin ? (
                  <form action={resetPin}>
                    <input type="hidden" name="profileId" value={s.id} />
                    <ConfirmButton
                      className="btn ghost"
                      confirmLabel="Sí, restablecer"
                      message={`¿Borrar el PIN de ${s.name}? Tendrá que elegir uno nuevo al entrar.`}
                    >
                      Restablecer PIN
                    </ConfirmButton>
                  </form>
                ) : null}
              </div>
              <div className="child-stats">
                <span>
                  Racha: <strong>{stats.streak === 1 ? '1 día' : `${stats.streak} días`}</strong>
                </span>
                <span>
                  Puntos esta semana: <strong>{stats.pointsWeek}</strong>
                </span>
                <span>
                  Último día de estudio:{' '}
                  <strong>
                    {stats.lastDay === null ? 'todavía ninguno' : stats.studiedToday ? 'hoy' : longDate(stats.lastDay)}
                  </strong>
                </span>
                {nextExam && (
                  <span>
                    Próximo examen:{' '}
                    <strong>
                      {nextExam.title} ({countdown(nextExam.days).toLowerCase()}, preparado al {nextExam.percent}%)
                    </strong>
                  </span>
                )}
              </div>
              <Link className="btn ghost" href={`/padres/hijo/${s.id}`}>
                Ver el progreso de {s.name}
              </Link>
              <ul style={{ margin: '12px 0', paddingLeft: 20 }}>
                {courses.map((c) => (
                  <li key={c.id}>
                    {c.name} · {c.school_year} — {c.subjects} {c.subjects === 1 ? 'asignatura' : 'asignaturas'}, {c.topics}{' '}
                    {c.topics === 1 ? 'tema' : 'temas'}{' '}
                    <span className={c.active ? 'badge' : 'badge off'}>{c.active ? 'Curso actual' : 'Archivado'}</span>
                  </li>
                ))}
              </ul>
              <details>
                <summary className="muted" style={{ cursor: 'pointer', marginBottom: 10 }}>
                  Pasar de curso
                </summary>
                <NewCourseForm profileId={s.id} current={active} />
              </details>
              <details>
                <summary className="muted" style={{ cursor: 'pointer', marginBottom: 10 }}>
                  Cambiar el nombre o borrar el perfil
                </summary>
                <form action={renameStudent} className="row" style={{ marginBottom: 12 }}>
                  <input type="hidden" name="profileId" value={s.id} />
                  <input
                    key={s.name}
                    name="name"
                    className="grow"
                    aria-label={`Nombre nuevo de ${s.name}`}
                    defaultValue={s.name}
                    maxLength={30}
                    required
                  />
                  <button className="btn ghost">Guardar nombre</button>
                </form>
                <form action={deleteStudent}>
                  <input type="hidden" name="profileId" value={s.id} />
                  <ConfirmButton
                    confirmLabel="Sí, borrar todo"
                    message={`¿Borrar el perfil de ${s.name} con todos sus cursos, material, tarjetas, notas y progreso? No se puede deshacer.`}
                  >
                    Borrar el perfil de {s.name}
                  </ConfirmButton>
                </form>
              </details>
            </div>
          );
        })}
      </div>

      {students.length === 0 && <p className="muted">Todavía no hay ningún perfil de hijo. Añade uno aquí debajo.</p>}

      <h2>{students.length === 0 ? 'Añadir un hijo' : 'Añadir otro hijo'}</h2>
      <form action={addStudent} className="row">
        <input name="name" className="grow" placeholder="Nombre" aria-label="Nombre" maxLength={30} required />
        <input name="course" className="grow" placeholder="Curso (p. ej. 2º ESO)" aria-label="Curso" maxLength={40} required />
        <select name="stage" aria-label="Etapa" defaultValue="primaria">
          {Object.entries(STAGE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button className="btn">Añadir</button>
      </form>

      <h2>Inteligencia artificial</h2>
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <span className={aiReady(ai) ? 'badge' : 'badge off'}>
            {ai.provider === 'none'
              ? 'Sin configurar'
              : ai.provider === 'codex'
                ? 'Cuenta de ChatGPT (Codex)'
                : ai.openaiKey
                  ? 'Clave de API de OpenAI'
                  : 'Falta la clave de API'}
          </span>
          {codex && (
            <span className={codex.loggedIn ? 'badge' : 'badge off'}>
              {!codex.installed
                ? 'Codex no está instalado en el servidor'
                : codex.loggedIn
                  ? 'Codex con sesión iniciada'
                  : 'Codex sin sesión: ejecuta "codex login" en el servidor'}
            </span>
          )}
        </div>
        {codex?.installed && <p className="muted" style={{ marginTop: 0 }}>{codex.detail}</p>}

        <form action={saveAiSettings} className="settings">
          <label>
            Proveedor
            {/* key: fuerza a redibujar la lista tras guardar para que muestre el valor guardado */}
            <select key={ai.provider} name="provider" defaultValue={ai.provider}>
              <option value="none">Ninguno (IA desactivada)</option>
              <option value="codex">Cuenta de ChatGPT, mediante Codex</option>
              <option value="openai">Clave de la API de OpenAI</option>
            </select>
          </label>
          <label>
            Modelo de Codex (opcional)
            <input name="codex_model" defaultValue={ai.codexModel} placeholder="El predeterminado de Codex" maxLength={60} />
          </label>
          <label>
            Clave de la API de OpenAI
            <input
              name="openai_key"
              type="password"
              autoComplete="off"
              placeholder={ai.openaiKey ? `Guardada (termina en ${ai.openaiKey.slice(-4)})` : 'sk-…'}
              maxLength={300}
            />
          </label>
          <label>
            Modelo de la API
            <input name="openai_model" defaultValue={ai.openaiModel} maxLength={60} />
          </label>
          {ai.openaiKey && (
            <label className="check">
              <input type="checkbox" name="forget_key" /> Borrar la clave guardada
            </label>
          )}
          <button className="btn">Guardar</button>
        </form>

        {aiReady(ai) && (
          <div style={{ marginTop: 14 }}>
            <AiTestButton />
          </div>
        )}
      </div>
    </>
  );
}
