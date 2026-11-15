'use client';

import { useActionState } from 'react';
import { testAi, type AiTestState } from '@/lib/actions';

const initial: AiTestState = { ok: false, message: '' };

export function AiTestButton() {
  const [state, action, pending] = useActionState(testAi, initial);
  return (
    <form action={action} className="row">
      <button className="btn ghost" disabled={pending}>
        {pending ? 'Probando…' : 'Probar conexión'}
      </button>
      <span role="status" className={pending ? 'muted' : state.ok ? 'ok' : 'error'}>
        {pending ? 'Puede tardar hasta un minuto.' : state.message}
      </span>
    </form>
  );
}
