import Link from 'next/link';
import type { TopicProgress } from '@/lib/overview';
import { formatScore } from '@/lib/topics';

function score(value: number | null): string {
  return value === null ? '—' : formatScore(value);
}

/** Avance tema a tema: pasos de la ruta, tarjetas estudiadas y mejores notas. */
export function TopicProgressTable({ topics }: { topics: TopicProgress[] }) {
  return (
    <>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Tema</th>
              <th className="num">Ruta</th>
              <th className="num">Tarjetas</th>
              <th className="num">Mejor quiz</th>
              <th className="num">Explicación</th>
              <th className="num">Mejor simulacro</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/tema/${t.id}`}>
                    <strong>{t.title}</strong>
                  </Link>
                  <br />
                  <span className="muted">{t.subject}</span>
                </td>
                <td className="num">
                  {t.stepsDone} de {t.stepsTotal}
                </td>
                <td className="num">{t.cards === 0 ? '—' : `${t.studied} de ${t.cards}`}</td>
                <td className="num">{score(t.quiz)}</td>
                <td className="num">{score(t.explain)}</td>
                <td className="num">{score(t.exam)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>
        Ruta: pasos completados de los seis de cada tema (material, resumen, tarjetas, quiz, explicación y simulacro). Las
        notas son sobre 10.
      </p>
    </>
  );
}
