import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoRefresh } from '@/components/AutoRefresh';
import { ConfirmButton } from '@/components/ConfirmButton';
import { addCard, deleteCard, generateCards } from '@/lib/actions';
import { aiReady } from '@/lib/ai';
import { requireProfile } from '@/lib/auth';
import { getDb, type Flashcard, type TopicJob } from '@/lib/db';
import { endOfToday, getTopicFor } from '@/lib/topics';

export const dynamic = 'force-dynamic';

function nextReview(card: Flashcard, today: number): string {
  if (card.reps === 0 && card.due_at === 0) return 'Nueva';
  if (card.due_at <= today) return 'Toca hoy';
  const days = Math.ceil((card.due_at - today) / 86_400_000);
  return days === 1 ? 'Mañana' : `En ${days} días`;
}

export default async function CardsPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireProfile();
  const topic = getTopicFor(me, Number((await params).id));
  if (!topic) notFound();
  const db = getDb();
  const cards = db.prepare('SELECT * FROM flashcards WHERE topic_id = ? ORDER BY id').all(topic.id) as Flashcard[];
  const job = db.prepare("SELECT * FROM topic_jobs WHERE topic_id = ? AND kind = 'cards'").get(topic.id) as
    | TopicJob
    | undefined;
  const hasMaterial = Boolean(
    db
      .prepare(
        "SELECT 1 FROM materials WHERE topic_id = ? AND status IN ('text', 'pending_ai') LIMIT 1",
      )
      .get(topic.id),
  );
  const today = endOfToday();
  const due = cards.filter((c) => c.due_at <= today).length;
  const running = job?.status === 'running';
  const base = `/tema/${topic.id}/tarjetas`;

  return (
    <div className={`stage-${topic.stage}`}>
      <div className="crumbs">
        <Link href={`/asignatura/${topic.subject_id}`}>{topic.subject}</Link> ›{' '}
        <Link href={`/tema/${topic.id}`}>{topic.title}</Link> ›
      </div>
      <h1>Tarjetas</h1>
      <p className="muted">
        {cards.length === 0
          ? 'Todavía no hay tarjetas en este tema.'
          : `${cards.length === 1 ? '1 tarjeta' : `${cards.length} tarjetas`} · ${due} para hoy`}
      </p>

      {cards.length > 0 && (
        <div className="grid" style={{ marginTop: 16 }}>
          <Link href={`${base}/estudiar?modo=aprender`} className="card mode-card">
            <strong>Aprender</strong>
            <span className="muted">Todas las tarjetas, repitiendo las que falles hasta sabértelas.</span>
          </Link>
          {due > 0 ? (
            <Link href={`${base}/estudiar?modo=repaso`} className="card mode-card">
              <strong>Repasar ({due})</strong>
              <span className="muted">Solo las que tocan hoy. La app decide cuándo vuelve cada una.</span>
            </Link>
          ) : (
            <div className="card mode-card off">
              <strong>Repasar</strong>
              <span className="muted">Hoy no toca ninguna. ¡Al día!</span>
            </div>
          )}
        </div>
      )}

      <h2>Crear con IA</h2>
      {running && <AutoRefresh />}
      {running ? (
        <div className="banner" role="status">
          <strong>La IA está trabajando.</strong> {job?.step} Puede tardar un par de minutos.
        </div>
      ) : !aiReady() ? (
        <div className="empty">La IA todavía no está conectada. Pídeselo a tus padres.</div>
      ) : !hasMaterial ? (
        <div className="empty">
          Sube primero material al tema para que la IA pueda crear tarjetas. <Link href={`/tema/${topic.id}`}>Ir al tema →</Link>
        </div>
      ) : (
        <form action={generateCards} className="row">
          <input type="hidden" name="topicId" value={topic.id} />
          <button className="btn">{cards.length === 0 ? 'Crear tarjetas' : 'Crear más tarjetas'}</button>
          <span className="muted">
            {cards.length === 0 ? 'A partir del material del tema.' : 'Añade tarjetas sobre lo que aún no está cubierto.'}
          </span>
        </form>
      )}
      {!running && job?.error && (
        <p className={job.status === 'error' ? 'error' : 'muted'} style={{ marginTop: 10 }}>
          {job.status === 'error' ? `No se pudieron crear las tarjetas: ${job.error}` : job.error}
        </p>
      )}

      <h2>Añadir una a mano</h2>
      <form action={addCard} className="paste">
        <input type="hidden" name="topicId" value={topic.id} />
        <input name="front" placeholder="Pregunta" aria-label="Pregunta" maxLength={500} required />
        <textarea name="back" rows={2} placeholder="Respuesta" aria-label="Respuesta" maxLength={1000} required />
        <button className="btn">Añadir tarjeta</button>
      </form>

      {cards.length > 0 && (
        <>
          <h2>Todas las tarjetas</h2>
          <div className="list">
            {cards.map((c) => (
              <div key={c.id} className="card-row">
                <div className="card-row-text">
                  <strong>{c.front}</strong>
                  <span>{c.back}</span>
                  <span className={c.due_at <= today ? 'badge' : 'badge off'}>{nextReview(c, today)}</span>
                </div>
                <form action={deleteCard}>
                  <input type="hidden" name="cardId" value={c.id} />
                  <ConfirmButton message="¿Borrar esta tarjeta? No se puede deshacer.">Borrar</ConfirmButton>
                </form>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
