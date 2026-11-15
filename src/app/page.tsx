import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth';
import { getDb, isSetUp } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Row = { id: number; name: string; role: string; color: string; course: string | null };

export default async function ProfilePicker() {
  if (!isSetUp()) redirect('/configurar');
  const me = await getCurrentProfile();
  if (me) redirect(me.role === 'parent' ? '/padres' : '/inicio');

  const profiles = getDb()
    .prepare(
      `SELECT p.id, p.name, p.role, p.color,
              (SELECT name FROM courses c WHERE c.profile_id = p.id AND c.active = 1) AS course
         FROM profiles p
        ORDER BY p.role = 'parent', p.name`,
    )
    .all() as Row[];

  return (
    <>
      <h1>¿Quién va a estudiar?</h1>
      <p className="muted">Elige tu perfil para entrar.</p>
      <div className="grid" style={{ marginTop: 20 }}>
        {profiles.map((p) => (
          <Link key={p.id} href={`/entrar/${p.id}`} className="card profile-card">
            <span className="avatar" style={{ background: p.color }}>
              {p.name[0]}
            </span>
            <strong>{p.name}</strong>
            <span className="muted">{p.role === 'parent' ? 'Panel de padres' : p.course}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
