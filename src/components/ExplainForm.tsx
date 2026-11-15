'use client';

import { useActionState } from 'react';
import { submitExplanation, type ExplainState } from '@/lib/actions';

const initial: ExplainState = { error: '' };

export function ExplainForm({ topicId, disabled }: { topicId: number; disabled: boolean }) {
  const [state, action, pending] = useActionState(submitExplanation, initial);
  return (
    <form action={action} className="paste">
      <input type="hidden" name="topicId" value={topicId} />
      <textarea
        name="text"
        rows={10}
        maxLength={6000}
        required
        placeholder="Cuenta el tema como se lo explicarías a un compañero que no ha ido a clase: de qué trata, las ideas principales, ejemplos…"
        aria-label="Tu explicación"
      />
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn" disabled={pending || disabled}>
        {pending ? 'Enviando…' : 'Enviar a revisar'}
      </button>
    </form>
  );
}
