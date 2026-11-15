import { useState, type FormEvent } from 'react';
import { wordmarkWhite } from '../assets/brand/logos';
import { loginWithOperatorToken } from '../data/backend-persistence';
import { useStore } from '../lib/store';

/** Pantalla única sin sesión. No muestra navegación ni datos. */
export function LockScreen({ checking = false }: { checking?: boolean }) {
  const { reconnect } = useStore();
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState<'idle' | 'loading' | 'error'>('idle');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (checking || phase === 'loading' || password.length === 0) return;
    setPhase('loading');
    const result = await loginWithOperatorToken(password);
    setPassword('');
    if (!result.ok) { setPhase('error'); return; }
    await reconnect();
  };

  const busy = checking || phase === 'loading';
  return (
    <div className="lock" role="dialog" aria-modal="true" aria-labelledby="lock-title" aria-busy={busy}>
      <form className="lock__panel" onSubmit={submit}>
        <img className="lock__logo" src={wordmarkWhite} alt="Sparked Reactions" />
        <h1 id="lock-title" className="sr-only">Entrar</h1>
        {checking ? <p className="lock__status">Leyendo…</p> : (
          <>
            <label className="lock__field">
              <span>Clave</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (phase === 'error') setPhase('idle'); }}
                disabled={phase === 'loading'}
                aria-invalid={phase === 'error'}
              />
            </label>
            {phase === 'error' && <p className="lock__error" role="alert">Clave incorrecta.</p>}
            <button className="lock__enter" type="submit" disabled={busy || password.length === 0}>
              {phase === 'loading' ? 'Entrando…' : 'Entrar'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
