import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type DependencyList } from 'react';
import { MockAdapter, SourceAdapter, setDataClock, AdapterError, type DataAdapter, type DemoMode } from '../data/adapter';
import { type AppAccess } from '../data/access';
import { BackendPersistence, probeBackendSession } from '../data/backend-persistence';
import { emptyDataset } from '../data/empty';
import { loadLiveDataset, SessionRequiredError } from '../data/load-live';
import type { OperatorActor } from '../data/backend-persistence';
import { clearDemoDrafts, ClaudeDbPersistence, LocalStoragePersistence, detectClaudeDb, type PersistenceKind } from '../data/persistence';
import { UnavailableAdapter } from '../data/unavailable';

interface Store {
  adapter: DataAdapter;
  access: AppAccess;
  mode: DemoMode;
  setMode: (m: DemoMode) => void;
  /** versión que cambia cuando el adaptador muta datos o cambia el modo */
  version: number;
  toast: (msg: string) => void;
  persistence: { kind: PersistenceKind; label: string; short: string };
  reconnect: () => Promise<void>;
  logout: () => Promise<void>;
  actor: OperatorActor | null;
  capabilities: { ghlConnected: boolean; ghlWrites: boolean; sends: boolean };
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const modeRef = useRef<{ current: DemoMode }>({ current: 'normal' });
  const [mode, setModeState] = useState<DemoMode>('normal');
  const [version, setVersion] = useState(0);
  const [adapter, setAdapter] = useState<DataAdapter>(() => new MockAdapter({ current: 'normal' }, emptyDataset()));
  const [access, setAccess] = useState<AppAccess>('checking');
  const [actor, setActor] = useState<OperatorActor | null>(null);
  const [capabilities, setCapabilities] = useState({ ghlConnected: false, ghlWrites: false, sends: false });
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [persistence, setPersistence] = useState<{ kind: PersistenceKind; label: string; short: string }>({ kind: 'none', label: 'Conectando…', short: '…' });
  const [persistenceEpoch, setPersistenceEpoch] = useState(0);
  useEffect(() => {
    const source = adapter as MockAdapter;
    if (typeof source.subscribe !== 'function') return;
    return source.subscribe(() => setVersion((v) => v + 1));
  }, [adapter]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const authed = await probeBackendSession();
      if (!alive) return;
      if (authed) {
        clearDemoDrafts();
        setActor(authed);
        try {
          const live = await loadLiveDataset();
          setDataClock(() => new Date());
          const source = new SourceAdapter(modeRef.current, live.dataset, live.ghlOk);
          await source.attachPersistence(new BackendPersistence());
          if (!alive) return;
          setAdapter(source);
          setPersistence(source.persistenceInfo);
          setAccess('live');
        } catch (error) {
          setDataClock(null);
          if (!alive) return;
          if (error instanceof SessionRequiredError) {
            setActor(null);
            setAdapter(new MockAdapter(modeRef.current, emptyDataset()));
            setPersistence({ kind: 'none', label: 'Sin sesión', short: 'Bloqueado' });
            setAccess('locked');
            return;
          }
          setAdapter(new UnavailableAdapter(error instanceof AdapterError ? error : new AdapterError('network', 'No se pudo leer la fuente de datos.')));
          setPersistence({ kind: 'backend', label: 'No se pudo leer el servidor', short: 'Error' });
          setAccess('live');
        }
        return;
      }
      setActor(null);
      if (import.meta.env.VITE_DEMO === '1') {
        setDataClock(null);
        const db = await detectClaudeDb();
        const { fixtures } = await import('../data/fixtures');
        const demo = new MockAdapter(modeRef.current, fixtures);
        if (db) await demo.attachPersistence(new ClaudeDbPersistence(db));
        else if (LocalStoragePersistence.available()) await demo.attachPersistence(new LocalStoragePersistence());
        if (!alive) return;
        setAdapter(demo);
        setPersistence(demo.persistenceInfo);
        setAccess('demo');
        return;
      }
      setDataClock(null);
      setAdapter(new MockAdapter(modeRef.current, emptyDataset()));
      setPersistence({ kind: 'none', label: 'Sin sesión', short: 'Bloqueado' });
      setAccess('locked');
    })();
    return () => { alive = false; };
  }, [persistenceEpoch]);
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3200);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const logout = async () => {
    await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' }).catch(() => undefined);
    clearDemoDrafts();
    setDataClock(null);
    modeRef.current.current = 'normal';
    setModeState('normal');
    setActor(null);
    setAdapter(new MockAdapter(modeRef.current, emptyDataset()));
    setPersistence({ kind: 'none', label: 'Sin sesión', short: 'Bloqueado' });
    setAccess('locked');
  };
  useEffect(() => {
    if (access !== 'live') return;
    let alive = true;
    fetch('/api/health').then((response) => response.json()).then((body: { ghl?: string; liveReads?: boolean; ghlWrites?: string; sends?: string }) => {
      if (!alive) return;
      setCapabilities({
        ghlConnected: body.ghl === 'verified' || body.liveReads === true,
        ghlWrites: body.ghlWrites === 'enabled',
        sends: body.sends === 'enabled',
      });
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [access]);
  const value: Store = {
    adapter, access, actor, capabilities, mode, version, persistence,
    setMode: (m) => { modeRef.current.current = m; setModeState(m); setVersion((v) => v + 1); },
    toast: (m) => setToastMsg(m),
    reconnect: async () => { setPersistenceEpoch((n) => n + 1); },
    logout,
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
