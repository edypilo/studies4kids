import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmButton } from '@/components/ConfirmButton';
import { deleteExam } from '@/lib/actions';
import { requireProfile } from '@/lib/auth';
import { countdown, daysUntil, examProgress, examTopics, getExamFor, longDate } from '@/lib/exams';

export const dynamic = 'force-dynamic';

/** Un examen del colegio: cuenta atrás y ruta de estudio de cada tema que entra. */
export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireProfile();
  const exam = getExamFor(me, Number((await params).id));
  if (!exam) notFound();
  const topics = examTopics(exam.id);
  const progress = examProgress(topics);
  const days = daysUntil(exam.date);
  const left = progress.total - progress.done;

  // El siguiente paso: el primero sin hacer, recorriendo los temas en orden.
  const next = topics.flatMap((t) => t.steps.map((s) => ({ topic: t.title, step: s }))).find((x) => !x.step.done);
  const pace =
    left === 0
      ? '¡Ruta completa! Sigue repasando las tarjetas cada día hasta el examen.'
      : days <= 0
        ? `Te quedan ${left} pasos.`
        : `Te quedan ${left} pasos y ${days === 1 ? '1 día' : `${days} días`}: ${
            left <= days ? 'con un paso al día llegas' : `unos ${Math.ceil(left / days)} pasos al día`
          }.`;

  return (
    <div className={`stage-${exam.stage}`}>
      <div className="crumbs">
        <Link href={`/asignatura/${exam.subject_id}`}>{exam.subject}</Link> ›
      </div>
      <div className="row between">
        <h1>{exam.title}</h1>
        <form action={deleteExam}>
          <input type="hidden" name="examId" value={exam.id} />
          <ConfirmButton message="¿Borrar este examen? Los temas y lo que has estudiado no se borran.">
            Borrar examen
          </ConfirmButton>
        </form>
      </div>
      <p className="muted">{longDate(exam.date)}</p>

      <div className="exam-head card">
        <div>
          <span className={`countdown${days >= 0 && days <= 3 ? ' soon' : ''}`}>{countdown(days)}</span>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {pace}
          </p>
        </div>
        <div className="exam-progress">
          <strong>{progress.percent}%</strong>
          <div className="progress" aria-hidden="true">
            <div style={{ width: `${progress.percent}%` }} />
          </div>
          <span className="muted">
            {progress.done} de {progress.total} pasos
          </span>
        </div>
      </div>

      {next && (
        <Link href={next.step.href} className="card review-card">
          <strong>
            Siguiente paso: {next.step.label} · {next.topic}
          </strong>
          <span>Ir →</span>
        </Link>
      )}

      {topics.map((t) => (
        <section key={t.id}>
          <h2>
            <Link href={`/tema/${t.id}`}>{t.title}</Link>
          </h2>
          <ol className="route">
            {t.steps.map((s) => (
              <li key={s.key} className={s.done ? 'done' : s === next?.step ? 'current' : ''}>
                <Link href={s.href}>
                  <span className="route-mark" aria-hidden="true">
                    {s.done ? '✓' : ''}
                  </span>
                  <span className="route-label">{s.label}</span>
                  <span className="muted">{s.detail}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
