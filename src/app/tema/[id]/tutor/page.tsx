import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoRefresh } from '@/components/AutoRefresh';
import { ChatForm } from '@/components/ChatForm';
import { ConfirmButton } from '@/components/ConfirmButton';
import { clearTutorChat } from '@/lib/actions';
import { aiReady } from '@/lib/ai';
import { requireProfile } from '@/lib/auth';
import { getDb, type ChatMessage } from '@/lib/db';
import { getTopicFor } from '@/lib/topics';

export const dynamic = 'force-dynamic';

const STARTERS = [
  'Explícame lo más importante del tema',
  'Hazme una pregunta para ver si me lo sé',
  'Ponme un ejemplo fácil',
];

/** Tutor del tema: un chat que responde solo con el material subido y guía en vez de dar la solución. */
export default async function TutorPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireProfile();
  const topic = getTopicFor(me, Number((await params).id));
  if (!topic) notFound();
  const db = getDb();
  const messages = db.prepare('SELECT * FROM chat_messages WHERE topic_id = ? ORDER BY id').all(topic.id) as ChatMessage[];
  const hasMaterial = Boolean(
    db.prepare("SELECT 1 FROM materials WHERE topic_id = ? AND status IN ('text', 'pending_ai') LIMIT 1").get(topic.id),
  );
  const waiting = messages.some((m) => m.status === 'pending');
  const isOwner = me.id === topic.profile_id;

  return (
    <div className={`stage-${topic.stage}`}>
      <div className="crumbs">
        <Link href={`/asignatura/${topic.subject_id}`}>{topic.subject}</Link> ›{' '}
        <Link href={`/tema/${topic.id}`}>{topic.title}</Link> ›
      </div>
      <div className="row between">
        <h1>Tutor</h1>
        {/* Solo los padres pueden borrar la conversación: así siempre pueden revisarla. */}
        {me.role === 'parent' && messages.length > 0 && !waiting && (
          <form action={clearTutorChat}>
            <input type="hidden" name="topicId" value={topic.id} />
            <ConfirmButton message="¿Borrar toda la conversación? No se puede deshacer.">Borrar conversación</ConfirmButton>
          </form>
        )}
      </div>
      <p className="muted">
        {isOwner
          ? 'Pregúntale tus dudas sobre este tema. Responde con lo que hay en tu material y te ayuda a pensar, no te hace los deberes. Tus padres pueden ver esta conversación.'
          : 'Conversación con el tutor de este tema. Solo puede escribir quien lo estudia, desde su perfil.'}
      </p>
      {waiting && <AutoRefresh seconds={2} />}

      <div className="chat" aria-live="polite">
        {messages.length === 0 && <div className="empty">Todavía no hay mensajes.</div>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.role}${m.status === 'error' ? ' failed' : ''}`}>
            <span className="bubble-who">{m.role === 'user' ? (isOwner ? 'Tú' : 'Alumno') : 'Tutor'}</span>
            {m.status === 'pending' ? <span className="typing">Escribiendo…</span> : <p>{m.content}</p>}
          </div>
        ))}
      </div>

      {!isOwner ? null : !aiReady() ? (
        <div className="empty">La IA todavía no está conectada. Pídeselo a tus padres.</div>
      ) : !hasMaterial ? (
        <div className="empty">
          Sube primero material al tema para que el tutor sepa de qué hablar. <Link href={`/tema/${topic.id}`}>Ir al tema →</Link>
        </div>
      ) : (
        <ChatForm topicId={topic.id} waiting={waiting} suggestions={messages.length === 0 ? STARTERS : []} />
      )}
    </div>
  );
}
