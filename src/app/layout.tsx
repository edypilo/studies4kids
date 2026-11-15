import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { getCurrentProfile } from '@/lib/auth';
import { logoutAction } from '@/lib/actions';
import './globals.css';

export const metadata: Metadata = {
  title: 'Studies4Kids',
  description: 'App de estudio de la familia',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  return (
    <html lang="es">
      <body>
        <header className="topbar">
          <Link href={profile ? (profile.role === 'parent' ? '/padres' : '/inicio') : '/'} className="brand">
            Studies<span>4</span>Kids
          </Link>
          {profile && (
            <form action={logoutAction} className="who">
              <span className="avatar small" style={{ background: profile.color }}>
                {profile.name[0]}
              </span>
              <span className="who-name">{profile.name}</span>
              <button className="btn ghost">Salir</button>
            </form>
          )}
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
