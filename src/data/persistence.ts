/**
 * Persistencia de las decisiones de Adri (revisiones, fit, aprobaciones de borrador).
 * La UI y el MockAdapter no saben dónde se guarda: solo hablan con esta interfaz.
 *
 * Implementaciones:
 *  - LocalStoragePersistence: este navegador, este dispositivo. Respaldo cuando no hay nada más.
 *  - ClaudeDbPersistence: base de datos del artifact de claude.ai (compartida entre dispositivos y
 *    personas con acceso). Solo existe cuando la app corre como artifact publicado.
 *  - [PENDIENTE para María] BackendPersistence: la misma interfaz contra el backend real
 *    (GHL custom fields, una base pequeña, etc.). Cambiar una línea en store.tsx.
 */
import type { Review, FitAssessment, PaymentVerification, Stage } from './model';

export interface StageMove { opportunityId: string; stage: Stage; movedAt: string; by: 'adri' }

export interface SavedState {
  reviews: Review[];
  fits: FitAssessment[];
  /** id de borrador → fecha de aprobación ISO */
  draftApprovals: Record<string, string>;
  /** verificación de pago por oportunidad (Closed) */
  payments: PaymentVerification[];
  /** etapa movida a mano en el dashboard (pendiente de sincronizar con GHL) */
  stages: StageMove[];
}

export type PersistenceKind = 'none' | 'local' | 'cloud' | 'backend';

export interface Persistence {
  kind: PersistenceKind;
  /** Etiqueta para la UI. */
  label: string;
  /** Versión corta (pills). */
  short: string;
  load(): Promise<SavedState>;
  saveReview(r: Review): Promise<void>;
  saveFit(f: FitAssessment): Promise<void>;
  saveDraftApproval(draftId: string, approvedAt: string): Promise<void>;
  savePayment(p: PaymentVerification): Promise<void>;
  saveStage(m: StageMove): Promise<void>;
  /** Cambios hechos desde otro dispositivo o pestaña. */
  subscribe?(fn: (s: SavedState) => void): () => void;
}

const empty = (): SavedState => ({ reviews: [], fits: [], draftApprovals: {}, payments: [], stages: [] });

/* ---------- localStorage ---------- */
const LS_KEY = 'sparked.captacion.demo.v1';

export class LocalStoragePersistence implements Persistence {
  kind: PersistenceKind = 'local';
  label = 'Guardado en este navegador';
  short = 'Este navegador';
  private read(): SavedState {
    try { const raw = localStorage.getItem(LS_KEY); return raw ? { ...empty(), ...JSON.parse(raw) } : empty(); } catch { return empty(); }
  }
  private write(s: SavedState) { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* sin almacenamiento: seguimos en memoria */ } }
  async load() { return this.read(); }
  async saveReview(r: Review) { const s = this.read(); s.reviews.push(r); this.write(s); }
  async saveFit(f: FitAssessment) { const s = this.read(); s.fits.push(f); this.write(s); }
  async saveDraftApproval(id: string, at: string) { const s = this.read(); s.draftApprovals[id] = at; this.write(s); }
  async savePayment(p: PaymentVerification) { const s = this.read(); s.payments = [...s.payments.filter((x) => x.opportunityId !== p.opportunityId), p]; this.write(s); }
  async saveStage(m: StageMove) { const s = this.read(); s.stages = [...s.stages.filter((x) => x.opportunityId !== m.opportunityId), m]; this.write(s); }
  static available() { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; } catch { return false; } }
}

/* ---------- claude.ai artifact db ---------- */
// Tipos mínimos del runtime de artifacts (window.claude.use). Ver artifact-capabilities / db.d.ts.
type DocSnap = { id: string; exists: boolean; data(): Record<string, unknown> | undefined };
type QuerySnap = { docs: DocSnap[] };
type DocRef = { set(d: Record<string, unknown>): Promise<void>; get(): Promise<DocSnap> };
type ColRef = { doc(id?: string): DocRef; get(): Promise<QuerySnap>; onSnapshot(next: (q: QuerySnap) => void, err?: (e: unknown) => void): () => void };
type DB = { collection(path: string): ColRef; doc(path: string): DocRef };
type ClaudeRuntime = { use(name: string): Promise<unknown> };

export async function detectClaudeDb(): Promise<DB | null> {
  // el runtime de artifacts expone window.claude.use; fuera de claude.ai no existe
  const c = (window as unknown as { claude?: ClaudeRuntime }).claude;
  if (!c || typeof c.use !== 'function') return null;
  try { return (await c.use('db')) as DB | null; } catch { return null; }
}

export class ClaudeDbPersistence implements Persistence {
  kind: PersistenceKind = 'cloud';
  label = 'Guardado en la nube (compartido)';
  short = 'Nube · compartido';
  constructor(private db: DB) {}
  private async col<T>(name: string): Promise<T[]> {
    const q = await this.db.collection(name).get();
    return q.docs.filter((d) => d.exists).map((d) => d.data() as T);
  }
  async load(): Promise<SavedState> {
    const [reviews, fits, approvals, payments, stages] = await Promise.all([
      this.col<Review>('reviews'), this.col<FitAssessment>('fits'), this.col<{ draftId: string; approvedAt: string }>('draft_approvals'), this.col<PaymentVerification>('payments'), this.col<StageMove>('stages'),
    ]);
    return { reviews, fits, draftApprovals: Object.fromEntries(approvals.map((a) => [a.draftId, a.approvedAt])), payments, stages };
  }
  async saveReview(r: Review) { await this.db.collection('reviews').doc(r.id).set({ ...r }); }
  async saveFit(f: FitAssessment) { await this.db.collection('fits').doc(f.id).set({ ...f }); }
  async saveDraftApproval(draftId: string, approvedAt: string) { await this.db.collection('draft_approvals').doc(draftId).set({ draftId, approvedAt }); }
  async savePayment(p: PaymentVerification) { await this.db.collection('payments').doc(p.opportunityId).set({ ...p }); }
  async saveStage(m: StageMove) { await this.db.collection('stages').doc(m.opportunityId).set({ ...m }); }
  subscribe(fn: (s: SavedState) => void) {
    let state = empty();
    const unsubs = [
      this.db.collection('reviews').onSnapshot((q) => { state = { ...state, reviews: q.docs.filter((d) => d.exists).map((d) => d.data() as unknown as Review) }; fn(state); }, () => {}),
      this.db.collection('fits').onSnapshot((q) => { state = { ...state, fits: q.docs.filter((d) => d.exists).map((d) => d.data() as unknown as FitAssessment) }; fn(state); }, () => {}),
      this.db.collection('draft_approvals').onSnapshot((q) => {
        const draftApprovals = Object.fromEntries(q.docs.filter((d) => d.exists).map((d) => { const a = d.data() as { draftId: string; approvedAt: string }; return [a.draftId, a.approvedAt]; }));
        state = { ...state, draftApprovals }; fn(state);
      }, () => {}),
      this.db.collection('payments').onSnapshot((q) => { state = { ...state, payments: q.docs.filter((d) => d.exists).map((d) => d.data() as unknown as PaymentVerification) }; fn(state); }, () => {}),
      this.db.collection('stages').onSnapshot((q) => { state = { ...state, stages: q.docs.filter((d) => d.exists).map((d) => d.data() as unknown as StageMove) }; fn(state); }, () => {}),
    ];
    return () => unsubs.forEach((u) => u());
  }
}
