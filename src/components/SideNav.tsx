'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './Icons';

type Item = { href: string; label: string; icon: IconName; also?: string[] };

/** also: rutas de detalle que pertenecen a cada sección, para marcarla como activa también en ellas. */
const ITEMS: Item[] = [
  { href: '/inicio', label: 'Inicio', icon: 'home' },
  { href: '/temas', label: 'Mis temas', icon: 'layers', also: ['/asignatura', '/tema'] },
  { href: '/repasar', label: 'Repasar', icon: 'cards' },
  { href: '/tests', label: 'Tests', icon: 'check', also: ['/test', '/intento'] },
  { href: '/tutor', label: 'Tutor IA', icon: 'chat' },
  { href: '/examenes', label: 'Exámenes', icon: 'calendar', also: ['/examen'] },
  { href: '/progreso', label: 'Progreso', icon: 'chart' },
];

function under(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`);
}

/** Menú del alumno: columna a la izquierda en pantallas anchas, tira deslizable arriba en el móvil. */
export function SideNav({ due }: { due: number }) {
  const path = usePathname();
  // Dentro de un tema, sus tests y su tutor pertenecen a esas secciones y no a "Mis temas".
  const inTopicTool = /^\/tema\/\d+\/(tests|tutor)/.exec(path)?.[1];
  const active = (item: Item) => {
    if (inTopicTool) return item.href === `/${inTopicTool}`;
    return under(path, item.href) || (item.also ?? []).some((base) => under(path, base));
  };

  return (
    <nav className="sidenav" aria-label="Secciones">
      {ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className="sidenav-link" aria-current={active(item) ? 'page' : undefined}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
          {item.href === '/repasar' && due > 0 && (
            <span className="sidenav-count" aria-label={due === 1 ? '1 tarjeta para hoy' : `${due} tarjetas para hoy`}>
              {due > 99 ? '99+' : due}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
