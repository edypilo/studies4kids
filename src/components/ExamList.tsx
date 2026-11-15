import Link from 'next/link';
import { countdown, type ExamSummary } from '@/lib/exams';

/** Lista de exámenes con cuenta atrás y avance de la ruta de estudio. */
export function ExamList({ exams, showSubject }: { exams: ExamSummary[]; showSubject: boolean }) {
  return (
    <div className="list">
      {exams.map((e) => (
        <Link
          key={e.id}
          href={`/examen/${e.id}`}
          className="card exam-card"
          style={{ '--c': e.color } as React.CSSProperties}
        >
          <div className="exam-card-text">
            <strong>{e.title}</strong>
            <span className="muted">{showSubject ? `${e.subject} · ` : ''}Preparado al {e.percent}%</span>
            <div className="progress" aria-hidden="true">
              <div style={{ width: `${e.percent}%` }} />
            </div>
          </div>
          <span className={`countdown small${e.days >= 0 && e.days <= 3 ? ' soon' : ''}`}>{countdown(e.days)}</span>
        </Link>
      ))}
    </div>
  );
}
