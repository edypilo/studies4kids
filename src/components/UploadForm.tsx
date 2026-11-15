'use client';

import { useActionState } from 'react';
import { uploadMaterial, type UploadState } from '@/lib/actions';

const initial: UploadState = { errors: [], saved: 0 };

export function UploadForm({ topicId }: { topicId: number }) {
  const [state, action, pending] = useActionState(uploadMaterial, initial);
  return (
    <form action={action} className="upload">
      <input type="hidden" name="topicId" value={topicId} />
      <input
        type="file"
        name="files"
        aria-label="Archivos"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        multiple
        required
        className="grow"
      />
      <button className="btn" disabled={pending}>
        {pending ? 'Subiendo…' : 'Subir'}
      </button>
      <div className="upload-status" role="status">
        {pending && <span className="muted">Subiendo y leyendo los archivos, puede tardar un poco…</span>}
        {!pending && state.saved > 0 && (
          <span className="ok">{state.saved === 1 ? '1 archivo guardado.' : `${state.saved} archivos guardados.`}</span>
        )}
        {!pending &&
          state.errors.map((e) => (
            <p key={e} className="error">
              {e}
            </p>
          ))}
      </div>
    </form>
  );
}
