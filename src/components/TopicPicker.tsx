import Link from 'next/link';
import { Icon } from './Icons';
import type { TopicProgress } from '@/lib/overview';

/** Lista de temas agrupada por asignatura; cada tema lleva a una de sus herramientas (tests, tutor…). */
export function TopicPicker({
  topics,
  hrefOf,
  detailOf,
}: {
  topics: TopicProgress[];
  hrefOf: (t: TopicProgress) => string;
  detailOf: (t: TopicProgress) => string;
}) {
  const subjects = [...new Set(topics.map((t) => t.subject))];
  return (
    <>
      {subjects.map((subject) => (
        <section key={subject}>
          <h2>{subject}</h2>
          <div className="list">
            {topics
              .filter((t) => t.subject === subject)
              .map((t) => (
                <Link key={t.id} href={hrefOf(t)} className="pick" style={{ '--c': t.color } as React.CSSProperties}>
                  <span className="pick-dot" aria-hidden="true" />
                  <span className="pick-text">
                    <strong>{t.title}</strong>
                    <span className="muted">{detailOf(t)}</span>
                  </span>
                  <Icon name="arrow" size={18} />
                </Link>
              ))}
          </div>
        </section>
      ))}
    </>
  );
}

/** Aviso común cuando el curso todavía no tiene temas. */
export function NoTopics() {
  return (
    <div className="empty">
      Todavía no tienes temas. Crea una asignatura y su primer tema en <Link href="/temas">Mis temas</Link>.
    </div>
  );
}
