'use client';

import { useActionState, useState } from 'react';
import { setupFamily, type LoginState } from '@/lib/actions';
import type { Stage } from '@/lib/db';

type Child = { key: number; name: string; course: string; stage: Stage };

const initial: LoginState = { error: '' };
const blank = (key: number): Child => ({ key, name: '', course: '', stage: 'primaria' });

/** Primera configuración: PIN de padres y un perfil por hijo. Campos controlados para no perder lo escrito si hay un error.
 * Las etapas llegan como props: este componente corre en el navegador y no puede importar el módulo de la base de datos. */
export function SetupForm({ stages, maxChildren }: { stages: [string, string][]; maxChildren: number }) {
  const [state, action, pending] = useActionState(setupFamily, initial);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [children, setChildren] = useState<Child[]>([blank(0)]);
  const [nextKey, setNextKey] = useState(1);

  const mismatch = pin2 !== '' && pin !== pin2;
  const update = (key: number, patch: Partial<Child>) =>
    setChildren((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));
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
    <form action={action} className="setup">
      <div className="card">
        <h2>1. PIN de padres</h2>
        <p className="muted">
          De 4 a 8 números. Con él entras al panel de padres, donde se gestionan los perfiles y la conexión con la IA. No lo
          compartas con tus hijos.
        </p>
        <div className="row">
          <input name="pin" aria-label="PIN de padres" placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} {...pinProps} />
          <input
            name="pin2"
            aria-label="Repite el PIN"
            placeholder="Repite el PIN"
            value={pin2}
            onChange={(e) => setPin2(e.target.value)}
            {...pinProps}
          />
        </div>
        {mismatch && <p className="error">Los dos PIN no coinciden.</p>}
      </div>

      <div className="card">
        <h2>2. Tus hijos</h2>
        <p className="muted">Cada uno tendrá su perfil y elegirá su propio PIN la primera vez que entre.</p>
        <div className="list">
          {children.map((c, i) => (
            <div key={c.key} className="row">
              <input
                name="name"
                className="grow"
                placeholder="Nombre"
                aria-label={`Nombre del hijo ${i + 1}`}
                maxLength={30}
                required
                value={c.name}
                onChange={(e) => update(c.key, { name: e.target.value })}
              />
              <input
                name="course"
                className="grow"
                placeholder="Curso (p. ej. 2º ESO)"
                aria-label={`Curso del hijo ${i + 1}`}
                maxLength={40}
                required
                value={c.course}
                onChange={(e) => update(c.key, { course: e.target.value })}
              />
              <select
                name="stage"
                aria-label={`Etapa del hijo ${i + 1}`}
                value={c.stage}
                onChange={(e) => update(c.key, { stage: e.target.value as Stage })}
              >
                {stages.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {children.length > 1 && (
                <button
                  type="button"
                  className="btn ghost"
                  aria-label={`Quitar al hijo ${i + 1}`}
                  onClick={() => setChildren((list) => list.filter((x) => x.key !== c.key))}
                >
                  Quitar
                </button>
              )}
            </div>
          ))}
        </div>
        {children.length < maxChildren && (
          <button
            type="button"
            className="btn ghost"
            style={{ marginTop: 12 }}
            onClick={() => {
              setChildren((list) => [...list, blank(nextKey)]);
              setNextKey(nextKey + 1);
            }}
          >
            + Añadir otro hijo
          </button>
        )}
      </div>

      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn" disabled={pending || mismatch}>
        {pending ? 'Guardando…' : 'Guardar y entrar'}
      </button>
    </form>
  );
}
