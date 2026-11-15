'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from '@/lib/actions';

const initial: LoginState = { error: '' };

export function PinForm({ profileId, needsSetup }: { profileId: number; needsSetup: boolean }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  const pinProps = {
    type: 'password',
    inputMode: 'numeric' as const,
    pattern: '[0-9]{4,8}',
    minLength: 4,
    maxLength: 8,
    required: true,
    autoComplete: 'off',
  };
  return (
    <form action={action}>
      <input type="hidden" name="profileId" value={profileId} />
      <input name="pin" aria-label={needsSetup ? 'PIN nuevo' : 'PIN'} placeholder="PIN" autoFocus {...pinProps} />
      {needsSetup && <input name="pin2" aria-label="Repite el PIN" placeholder="Repite el PIN" {...pinProps} />}
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn" disabled={pending}>
        {needsSetup ? 'Guardar PIN y entrar' : 'Entrar'}
      </button>
    </form>
  );
}
