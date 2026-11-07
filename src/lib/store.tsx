import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type DependencyList } from 'react';
import { MockAdapter, AdapterError, type DataAdapter, type DemoMode } from '../data/adapter';
import { ClaudeDbPersistence, LocalStoragePersistence, detectClaudeDb, type PersistenceKind } from '../data/persistence';

interface Store {
  adapter: DataAdapter;
  mode: DemoMode;
  setMode: (m: DemoMode) => void;
  /** versión que cambia cuando el adaptador muta datos o cambia el modo */
  version: number;
  toast: (msg: string) => void;
  persistence: { kind: PersistenceKind; label: string; short: string };
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const modeRef = useRef<{ current: DemoMode }>({ current: 'normal' });
  const [mode, setModeState] = useState<DemoMode>('normal');
  const [version, setVersion] = useState(0);
  const adapter = useMemo(() => new MockAdapter(modeRef.current), []);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [persistence, setPersistence] = useState<{ kind: PersistenceKind; label: string; short: string }>({ kind: 'none', label: 'Conectando…', short: '…' });
  useEffect(() => adapter.subscribe(() => setVersion((v) => v + 1)), [adapter]);
  useEffect(() => {
    let alive = true;
    (async () => {
      // 1) db del artifact de claude.ai (compartida entre dispositivos) 2) localStorage 3) solo memoria
      const db = await detectClaudeDb();
      const p = db ? new ClaudeDbPersistence(db) : LocalStoragePersistence.available() ? new LocalStoragePersistence() : null;
      if (p) await adapter.attachPersistence(p);
      if (alive) setPersistence(adapter.persistenceInfo);
    })();
    return () => { alive = false; };
  }, [adapter]);
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3200);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const value: Store = {
    adapter, mode, version, persistence,
    setMode: (m) => { modeRef.current.current = m; setModeState(m); setVersion((v) => v + 1); },
    toast: (m) => setToastMsg(m),
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && <div className="toast" role="status" aria-live="polite">{toastMsg}</div>}
    </Ctx.Provider>
  );
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

export type QueryState<T> =
  | { status: 'loading'; data?: T }
  | { status: 'error'; error: AdapterError; data?: T }
  | { status: 'ready'; data: T };

/** Lee del adaptador y reacciona a cambios (mutaciones locales, modo demo). */
export function useQuery<T>(fn: (a: DataAdapter) => Promise<T>, deps: DependencyList = []): QueryState<T> & { reload: () => void } {
  const { adapter, version } = useStore();
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ status: 'loading', data: s.data }));
    fn(adapter).then(
      (data) => { if (alive) setState({ status: 'ready', data }); },
      (e) => { if (alive) setState({ status: 'error', error: e instanceof AdapterError ? e : new AdapterError('unknown', String(e)) }); },
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, version, tick, ...deps]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}
