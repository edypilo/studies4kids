import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PinForm } from '@/components/PinForm';
import { getDb, type Profile } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Enter({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = getDb()
    .prepare('SELECT id, name, role, color, pin_hash FROM profiles WHERE id = ?')
    .get(Number(id)) as Profile | undefined;
  if (!profile) notFound();
  const needsSetup = !profile.pin_hash;

  return (
    <div className="pin-box">
      <span className="avatar" style={{ background: profile.color }}>
        {profile.name[0]}
      </span>
      <h1>{profile.name}</h1>
      <p className="muted">
        {needsSetup ? 'Es tu primera vez: elige un PIN de 4 a 8 números y no lo olvides.' : 'Escribe tu PIN.'}
      </p>
      <PinForm profileId={profile.id} needsSetup={needsSetup} />
      <Link href="/" className="muted">
        ← Cambiar de perfil
      </Link>
    </div>
  );
}
