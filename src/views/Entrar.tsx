import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead, Note } from '../components/ui';
import { clearBackendEnabled, loginWithOperatorToken, markBackendEnabled } from '../data/backend-persistence';
import { useStore } from '../lib/store';

/** Fuera del menú. No cambia las pantallas ya aprobadas. El token no se guarda. */
export function Entrar() {
  const navigate = useNavigate();
  const { reconnect } = useStore();
  const [token, setToken] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const result = await loginWithOperatorToken(token);
    setToken('');
    setBusy(false);
    if (!result.ok) { setMessage(result.error); return; }
    markBackendEnabled(localStorage);
    await reconnect();
    navigate('/');
  };

  const leave = async () => {
    clearBackendEnabled(localStorage);
    await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' }).catch(() => undefined);
    await reconnect();
    setMessage('Sesión cerrada en este navegador. La demo sigue en local.');
  };

  return (
    <>
      <PageHead title="Entrar" sub="Solo para cuando el servidor ya tiene acceso configurado. La demo no lo necesita." />
      <form className="card stack" style={{ gap: 14, maxWidth: 460 }} onSubmit={submit}>
        <div className="field">
          <label htmlFor="operator-token">Clave de operadora</label>
          <input id="operator-token" type="password" autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} />
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" type="submit" disabled={busy || token.length === 0}>Entrar</button>
          <button className="btn btn--secondary" type="button" onClick={leave}>Cerrar sesión</button>
        </div>
        {message && <Note tone="butter">{message}</Note>}
      </form>
    </>
  );
}
