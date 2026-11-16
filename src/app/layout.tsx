import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { getCurrentProfile } from '@/lib/auth';
import { logoutAction } from '@/lib/actions';
import { LogoMark } from '@/components/Logo';
import { SideNav } from '@/components/SideNav';
import { dueCount } from '@/lib/topics';
// Tipografía de títulos, servida desde la propia app (sin peticiones a internet).
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/poppins/800.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Studies4Kids',
  description: 'Aprender hoy. Recordar mañana. La app de estudio de la familia.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#4f6df5' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  const student = profile?.role === 'student';
  return (
    <html lang="es">
      <body>
        <header className="topbar">
          <Link href={profile ? (profile.role === 'parent' ? '/padres' : '/inicio') : '/'} className="brand">
            <LogoMark size={34} />
            <span className="brand-name">
              Studies<span>4</span>Kids
            </span>
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
        {student ? (
          <div className="shell">
            <SideNav due={dueCount(profile.id)} />
            <main className="page">{children}</main>
          </div>
        ) : (
          <main className="page">{children}</main>
        )}
      </body>
    </html>
  );
}
