'use client';

import { useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { sendTutorMessage } from '@/lib/actions';

function SendButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" disabled={pending || disabled}>
      Enviar
    </button>
  );
}

/** Caja para escribir al tutor. Intro envía; Mayús+Intro hace un salto de línea. */
export function ChatForm({ topicId, waiting, suggestions }: { topicId: number; waiting: boolean; suggestions: string[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Mantiene a la vista el final de la conversación cuando llega algo nuevo.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [waiting, suggestions.length]);

  const ask = (text: string) => {
    if (!boxRef.current || waiting) return;
    boxRef.current.value = text;
    formRef.current?.requestSubmit();
  };

  return (
    <div className="chat-input">
      {suggestions.length > 0 && !waiting && (
        <div className="row">
          {suggestions.map((s) => (
            <button key={s} type="button" className="btn chip" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <form ref={formRef} action={sendTutorMessage} className="chat-form">
        <input type="hidden" name="topicId" value={topicId} />
        <textarea
          ref={boxRef}
          name="message"
          rows={2}
          maxLength={1000}
          required
          placeholder={waiting ? 'Espera a que el tutor responda…' : 'Escribe tu pregunta…'}
          aria-label="Tu mensaje"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!waiting) e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <SendButton disabled={waiting} />
      </form>
      <div ref={endRef} />
    </div>
  );
}
