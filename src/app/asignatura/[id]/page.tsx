import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmButton } from '@/components/ConfirmButton';
import { ExamList } from '@/components/ExamList';
import { addTopic, createExam, deleteSubject, deleteTopic } from '@/lib/actions';
import { listExams, todayISO } from '@/lib/exams';
import { canAccess, requireProfile } from '@/lib/auth';
import { getDb, type Stage, type Topic } from '@/lib/db';

export const dynamic = 'force-dynamic';

type SubjectRow = {
  id: number;
  name: string;
  color: string;
  course_id: number;
  course: string;
  stage: Stage;
  active: number;
  profile_id: number;
};

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireProfile();
  const { id } = await params;
  const db = getDb();
  const subject = db
    .prepare(
      `SELECT s.id, s.name, s.color, s.course_id, c.name AS course, c.stage, c.active, c.profile_id
         FROM subjects s JOIN courses c ON c.id = s.course_id WHERE s.id = ?`,
    )
    .get(Number(id)) as SubjectRow | undefined;
  if (!subject || !canAccess(me, subject.profile_id)) notFound();

  const topics = db
    .prepare('SELECT * FROM topics WHERE subject_id = ? ORDER BY position, id')
    .all(subject.id) as Topic[];
  const back = subject.active ? '/inicio' : `/inicio?curso=${subject.course_id}`;
  const exams = listExams({ subjectId: subject.id, includePast: true });

  return (
    <div className={`stage-${subject.stage}`}>
      <div className="crumbs">
        <Link href={back}>{subject.course}</Link> ›
      </div>
      <div className="row between">
        <h1 style={{ borderLeft: `8px solid ${subject.color}`, paddingLeft: 12 }}>{subject.name}</h1>
        <form action={deleteSubject}>
          <input type="hidden" name="subjectId" value={subject.id} />
          <ConfirmButton message={`¿Borrar "${subject.name}" con todos sus temas? No se puede deshacer.`}>
            Borrar asignatura
          </ConfirmButton>
        </form>
      </div>

      <h2>Temas</h2>
      {topics.length === 0 ? (
        <div className="empty">Aún no hay temas. Añade el primero aquí abajo.</div>
      ) : (
        <div className="list">
          {topics.map((t, i) => (
            <div key={t.id} className="list-item">
              <Link className="title" href={`/tema/${t.id}`}>
                {i + 1}. {t.title}
              </Link>
              <form action={deleteTopic}>
                <input type="hidden" name="topicId" value={t.id} />
                <ConfirmButton message={`¿Borrar el tema "${t.title}"? No se puede deshacer.`}>Borrar</ConfirmButton>
              </form>
            </div>
          ))}
        </div>
      )}

      <h2>Añadir tema</h2>
      <form action={addTopic} className="row">
        <input type="hidden" name="subjectId" value={subject.id} />
        <input name="title" className="grow" placeholder="Título del tema (p. ej. Las fracciones)" aria-label="Título del tema" maxLength={120} required />
        <button className="btn">Añadir</button>
      </form>

      <h2>Exámenes</h2>
      {exams.length > 0 && <ExamList exams={exams} showSubject={false} />}
      {topics.length === 0 ? (
        <div className="empty">Cuando tengas temas podrás apuntar aquí los exámenes y ver qué te falta por estudiar.</div>
      ) : (
        <details className="card" style={{ marginTop: 12 }} open={exams.length === 0}>
          <summary>Apuntar un examen</summary>
          <form action={createExam} className="paste">
            <input type="hidden" name="subjectId" value={subject.id} />
            <div className="row" style={{ width: '100%' }}>
              <input
                name="title"
                className="grow"
                placeholder="Nombre (p. ej. Examen del tema 3)"
                aria-label="Nombre del examen"
                maxLength={80}
                required
              />
              <input name="date" type="date" aria-label="Fecha del examen" min={todayISO()} required />
            </div>
            <fieldset className="topic-picker">
              <legend>¿Qué temas entran?</legend>
              {topics.map((t) => (
                <label key={t.id} className="check">
                  <input type="checkbox" name="topics" value={t.id} defaultChecked={topics.length === 1} /> {t.title}
                </label>
              ))}
            </fieldset>
            <button className="btn">Apuntar examen</button>
          </form>
        </details>
      )}
    </div>
  );
}
