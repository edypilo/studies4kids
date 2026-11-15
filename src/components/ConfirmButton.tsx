'use client';

import { useState } from 'react';

/**
 * Botón de envío con confirmación en la propia página (dos pasos).
 * No usa window.confirm: algunos navegadores integrados lo bloquean y el botón parecía no hacer nada.
 */
export function ConfirmButton({
  message,
  className = 'btn danger',
  confirmLabel = 'Sí, borrar',
  children,
}: {
  message: string;
  className?: string;
  confirmLabel?: string;
  children: React.ReactNode;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button type="button" className={className} onClick={() => setArmed(true)}>
        {children}
      </button>
    );
  }
  return (
    <span className="confirm" role="alertdialog" aria-label={message}>
      <span className="confirm-msg">{message}</span>
      <span className="confirm-actions">
        <button type="submit" className="btn danger-solid">
          {confirmLabel}
        </button>
        <button type="button" className="btn ghost" autoFocus onClick={() => setArmed(false)}>
          Cancelar
        </button>
      </span>
    </span>
  );
}
