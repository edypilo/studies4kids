import { notFound, redirect } from 'next/navigation';
import { StudySession } from '@/components/StudySession';
import { requireProfile } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { dueCards, getTopicFor, type StudyCard } from '@/lib/topics';

export const dynamic = 'force-dynamic';

export default async function StudyTopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ modo?: string }>;
}) {
  const me = await requireProfile();
  const topic = getTopicFor(me, Number((await params).id));
  if (!topic) notFound();
  const mode = (await searchParams).modo === 'repaso' ? 'review' : 'learn';
  const back = `/tema/${topic.id}/tarjetas`;

  const cards =
    mode === 'review'
      ? dueCards(topic.profile_id, { topicId: topic.id, limit: 50 })
      : (getDb()
          .prepare("SELECT id, front, back, '' AS label FROM flashcards WHERE topic_id = ? ORDER BY RANDOM()")
          .all(topic.id) as StudyCard[]);
  if (cards.length === 0) redirect(back);

  const label = `${topic.subject} · ${topic.title}`;
  return (
    <div className={`stage-${topic.stage}`}>
      <StudySession
        cards={cards.map((c) => ({ id: c.id, front: c.front, back: c.back, label }))}
        mode={mode}
        backHref={back}
        backLabel="Volver a las tarjetas"
      />
    </div>
  );
}
