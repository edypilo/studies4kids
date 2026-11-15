import type { Stats } from '@/lib/progress';

/** Racha, puntos de la semana y puntos totales, más los puntos de cada uno de los últimos 7 días. */
export function ProgressSummary({ stats, forParent = false }: { stats: Stats; forParent?: boolean }) {
  const max = Math.max(...stats.days.map((d) => d.points), 1);
  const top = stats.days.reduce((best, d) => (d.points > best.points ? d : best), stats.days[0]);

  return (
    <div className="progress-summary">
      <div className="tiles">
        <div className="tile">
          <span className="tile-label">Racha</span>
          <span className="tile-value">{stats.streak === 1 ? '1 día' : `${stats.streak} días`}</span>
          <span className="tile-note">
            {forParent
              ? stats.studiedToday
                ? 'Hoy ya ha estudiado'
                : 'Hoy todavía no ha estudiado'
              : stats.streak === 0
                ? 'Estudia hoy para empezarla'
                : stats.studiedToday
                  ? 'Hoy ya has estudiado'
                  : 'Estudia hoy para no perderla'}
          </span>
        </div>
        <div className="tile">
          <span className="tile-label">Puntos esta semana</span>
          <span className="tile-value">{stats.pointsWeek.toLocaleString('es-ES')}</span>
          <span className="tile-note">Últimos 7 días</span>
        </div>
        <div className="tile">
          <span className="tile-label">Puntos totales</span>
          <span className="tile-value">{stats.pointsTotal.toLocaleString('es-ES')}</span>
          <span className="tile-note">Desde el principio</span>
        </div>
      </div>

      <figure className="daybars">
        <figcaption>Puntos por día</figcaption>
        <div className="daybars-plot" role="img" aria-label="Puntos de los últimos 7 días">
          {stats.days.map((d) => (
            <div key={d.day} className="daybar" tabIndex={0}>
              <span className="daybar-tip">
                {d.today ? 'Hoy' : d.day.slice(8) + '/' + d.day.slice(5, 7)}: {d.points === 1 ? '1 punto' : `${d.points} puntos`}
              </span>
              {/* Solo se rotulan hoy y el mejor día; el resto se ve al pasar el ratón. */}
              <span className="daybar-value">{d.points > 0 && (d.today || d === top) ? d.points : ''}</span>
              <span
                className="daybar-mark"
                style={{ height: d.points === 0 ? 0 : `${Math.max(4, (d.points / max) * 72)}px` }}
              />
              <span className={d.today ? 'daybar-label today' : 'daybar-label'}>{d.today ? 'Hoy' : d.label}</span>
            </div>
          ))}
        </div>
        <table className="sr-only">
          <caption>Puntos de los últimos 7 días</caption>
          <tbody>
            {stats.days.map((d) => (
              <tr key={d.day}>
                <th scope="row">{d.day}</th>
                <td>{d.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </div>
  );
}
