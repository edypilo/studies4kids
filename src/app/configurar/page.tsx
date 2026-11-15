import { redirect } from 'next/navigation';
import { SetupForm } from '@/components/SetupForm';
import { MAX_SETUP_CHILDREN, STAGE_LABELS, isSetUp } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function Setup() {
  if (isSetUp()) redirect('/');
  return (
    <>
      <h1>Te damos la bienvenida</h1>
      <p className="muted">
        Antes de empezar, prepara la app para tu familia. Son dos pasos y todo se puede cambiar después desde el panel de
        padres.
      </p>
      <SetupForm stages={Object.entries(STAGE_LABELS)} maxChildren={MAX_SETUP_CHILDREN} />
    </>
  );
}
