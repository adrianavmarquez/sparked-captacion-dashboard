/**
 * Adaptador de datos. La UI SOLO habla con esta interfaz.
 * Hoy: MockAdapter en memoria (fixtures). Mañana: María implementa la misma
 * interfaz contra GHL / Gmail / enriquecimiento sin tocar la UI.
 * Regla: ningún método llama a la red en esta demo.
 */
import type {
  Dataset, ProspectRow, ProspectFilters, Page, Review, Draft, Followup,
  Opportunity, PaymentVerification, GoalProgress, AuditEvent, Freshness, ReviewState, Decision, FitAssessment, FitLevel, BudgetSignal, Offer, Stage, AgentStep,
} from './model';
import { fixtures, DEMO_NOW, GOAL_WINDOW } from './fixtures';
import type { Persistence, SavedState } from './persistence';

export type DemoMode = 'normal' | 'loading' | 'empty' | 'error' | 'forbidden';

export class AdapterError extends Error {
  constructor(public code: 'network' | 'forbidden' | 'unknown', message: string) {
    super(message);
  }
}

export interface DataAdapter {
  listProspects(filters: ProspectFilters, page: number, pageSize: number): Promise<Page<ProspectRow>>;
  getProspect(id: string): Promise<ProspectRow | null>;
  getAudit(prospectId: string): Promise<AuditEvent[]>;
  /** Pasos del agente tras la aprobación (los escribe María). */
  getAgentSteps(prospectId: string): Promise<AgentStep[]>;
  /** Conteo de razones de descarte, de las decisiones de Adri. */
  getDiscardReasons(): Promise<{ reason: string; count: number }[]>;
  saveReview(input: { prospectId: string; decision: Decision; reason?: string; revisitOn?: string }): Promise<Review>;
  saveFit(input: { prospectId: string; fit: FitLevel; services: Offer[]; budget: BudgetSignal; note?: string }): Promise<FitAssessment>;
  /** Hitos de una oportunidad Closed: anticipo 50%, entrega, saldo 50%. Cada uno con fecha. */
  setClosedStep(input: { opportunityId: string; step: 'deposit' | 'delivered' | 'balance'; done: boolean; amountContracted: number; on?: string }): Promise<PaymentVerification>;
  /** Mueve una oportunidad de etapa (arrastre). Queda guardado en el dashboard; la sincronización con GHL es futura. */
  moveStage(input: { opportunityId: string; stage: Stage }): Promise<Opportunity>;
  listDrafts(): Promise<Draft[]>;
  approveDraft(id: string): Promise<Draft>;
  listFollowups(): Promise<Followup[]>;
  listOpportunities(): Promise<{ opportunities: Opportunity[]; payments: PaymentVerification[] }>;
  getGoalProgress(): Promise<GoalProgress>;
  getLocalities(): Promise<string[]>;
  getMeta(): Promise<Dataset['meta']>;
}

/* ---------- Derivaciones (reglas de negocio visibles en la UI) ---------- */

export const DAY_MS = 86_400_000;
export const now = () => new Date(DEMO_NOW);

/** Frescura: ≤30 días; revalidar si >7 días. Norma operativa elegida por María por delegación (no fijada por Adri). */
export function freshnessOf(observedAt: string): Freshness {
  const age = (now().getTime() - new Date(observedAt).getTime()) / DAY_MS;
  if (age > 30) return 'obsoleta';
  if (age > 7) return 'revalidar';
  return 'fresca';
}

export function worstFreshness(list: { observedAt: string }[]): Freshness | 'sin_evidencia' {
  if (list.length === 0) return 'sin_evidencia';
  const order: Freshness[] = ['fresca', 'revalidar', 'obsoleta'];
  return list.map((e) => freshnessOf(e.observedAt)).sort((a, b) => order.indexOf(b) - order.indexOf(a))[0];
}

export function reviewStateOf(review: Review | null): ReviewState {
  if (!review) return 'pending';
  return review.decision === 'approve_contact' ? 'approved' : review.decision === 'maybe' ? 'maybe' : 'discarded';
}

/* ---------- Mock ---------- */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MockAdapter implements DataAdapter {
  private data: Dataset;
  private modeRef: { current: DemoMode };
  private listeners = new Set<() => void>();
  private persistence: Persistence | null = null;
  private seed: Dataset;

  constructor(modeRef: { current: DemoMode }, seed: Dataset = fixtures) {
    // copia profunda: la demo muta en memoria, nunca los fixtures ni el disco
    this.seed = seed;
    this.data = JSON.parse(JSON.stringify(seed));
    this.modeRef = modeRef;
  }

  /** Conecta una persistencia: carga lo guardado sobre los fixtures y escucha cambios remotos. */
  async attachPersistence(p: Persistence) {
    this.persistence = p;
    this.applySaved(await p.load());
    p.subscribe?.((s) => { this.applySaved(s); });
  }
  get persistenceInfo() { return this.persistence ? { kind: this.persistence.kind, label: this.persistence.label, short: this.persistence.short } : { kind: 'none' as const, label: 'Solo en memoria', short: 'Memoria' }; }

  private applySaved(saved: SavedState) {
    const base: Dataset = JSON.parse(JSON.stringify(this.seed));
    const ids = new Set(base.reviews.map((r) => r.id));
    base.reviews.push(...saved.reviews.filter((r) => !ids.has(r.id)));
    const fids = new Set(base.fits.map((f) => f.id));
    base.fits.push(...saved.fits.filter((f) => !fids.has(f.id)));
    for (const [id, at] of Object.entries(saved.draftApprovals)) {
      const dr = base.drafts.find((d) => d.id === id);
      if (dr && dr.status === 'draft') { dr.status = 'approved'; dr.approvedAt = at; }
    }
    // auditoría derivada de lo guardado
    for (const r of saved.reviews) base.audit.push({ id: `au_${r.id}`, entity: 'review', entityId: r.id, action: r.decision === 'approve_contact' ? 'Contacto aprobado' : r.decision === 'maybe' ? `Maybe: volver el ${r.revisitOn}` : `Descartado: ${r.reason}`, by: 'adri', at: r.decidedAt });
    for (const f of saved.fits) base.audit.push({ id: `au_${f.id}`, entity: 'fit', entityId: f.id, action: `Fit: ${f.fit.replace('_', ' ')} · ${f.services.join(', ') || 'sin servicio'} · presupuesto ${f.budget.replace('_', ' ')}`, by: 'adri', at: f.decidedAt });
    for (const [id, at] of Object.entries(saved.draftApprovals)) base.audit.push({ id: `au_ap_${id}`, entity: 'draft', entityId: id, action: 'Borrador aprobado', by: 'adri', at });
    for (const m of saved.stages ?? []) {
      const o = base.opportunities.find((x) => x.id === m.opportunityId);
      if (o) { o.stage = m.stage; o.updatedAt = m.movedAt; base.audit.push({ id: `au_st_${m.opportunityId}_${m.movedAt}`, entity: 'opportunity', entityId: m.opportunityId, action: `Movido a ${m.stage.replace('_', ' ')} (pendiente de sincronizar con GHL)`, by: 'adri', at: m.movedAt }); }
    }
    for (const pv of saved.payments ?? []) {
      base.payments = [...base.payments.filter((x) => x.opportunityId !== pv.opportunityId), pv];
      if (pv.depositVerified && pv.verifiedAt) base.audit.push({ id: `au_pay_d_${pv.opportunityId}`, entity: 'payment', entityId: pv.opportunityId, action: `Anticipo 50% verificado (${pv.depositReceived ?? 0} de ${pv.amountContracted ?? 0})`, by: 'adri', at: pv.verifiedAt });
      if (pv.deliveredAt) base.audit.push({ id: `au_pay_e_${pv.opportunityId}`, entity: 'payment', entityId: pv.opportunityId, action: 'Entregado', by: 'adri', at: pv.deliveredAt });
      if (pv.balanceVerifiedAt) base.audit.push({ id: `au_pay_s_${pv.opportunityId}`, entity: 'payment', entityId: pv.opportunityId, action: `Saldo 50% verificado (${pv.balanceReceived ?? 0})`, by: 'adri', at: pv.balanceVerifiedAt });
    }
    this.data = base;
    this.emit();
  }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.listeners.forEach((fn) => fn()); }

  private async gate() {
    const mode = this.modeRef.current;
    if (mode === 'loading') { await new Promise(() => {}); } // nunca resuelve: estado "cargando" permanente
    await wait(180);
    if (mode === 'error') throw new AdapterError('network', 'No se pudo leer la fuente de datos.');
    if (mode === 'forbidden') throw new AdapterError('forbidden', 'Esta cuenta no tiene permiso para ver esta sección.');
  }
  private get d(): Dataset {
    if (this.modeRef.current === 'empty') {
      return { ...this.data, prospects: [], evidence: [], contacts: [], reviews: [], fits: [], agentSteps: [], opportunities: [], payments: [], drafts: [], followups: [], audit: [] };
    }
    return this.data;
  }

  private row(prospectId: string): ProspectRow | null {
    const D = this.d;
    const prospect = D.prospects.find((p) => p.id === prospectId);
    if (!prospect) return null;
    const company = D.companies.find((c) => c.id === prospect.companyId)!;
    const evidence = D.evidence.filter((e) => e.prospectId === prospectId);
    const contacts = D.contacts.filter((c) => c.prospectId === prospectId);
    const review = [...D.reviews].filter((r) => r.prospectId === prospectId).sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))[0] ?? null;
    const opportunity = D.opportunities.find((o) => o.prospectId === prospectId) ?? null;
    const fit = [...D.fits].filter((f) => f.prospectId === prospectId).sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))[0] ?? null;
    return { prospect, company, evidence, contacts, review, fit, reviewState: reviewStateOf(review), freshness: worstFreshness(evidence), opportunity };
  }

  async listProspects(f: ProspectFilters, page: number, pageSize: number): Promise<Page<ProspectRow>> {
    await this.gate();
    const q = (f.query ?? '').trim().toLowerCase();
    let rows = this.d.prospects.map((p) => this.row(p.id)!).filter((r) => {
      if (q && !(`${r.company.name} ${r.company.industry} ${r.company.locality}`.toLowerCase().includes(q))) return false;
      if (f.offer && f.offer !== 'all' && r.prospect.offerInterest !== f.offer) return false;
      if (f.reviewState && f.reviewState !== 'all' && r.reviewState !== f.reviewState) return false;
      if (f.locality && f.locality !== 'all' && r.company.locality !== f.locality) return false;
      if (f.freshness && f.freshness !== 'all' && r.freshness !== f.freshness) return false;
      if (f.exclusion && f.exclusion !== 'all') {
        if (f.exclusion === 'none' ? r.prospect.exclusion !== null : r.prospect.exclusion !== f.exclusion) return false;
      }
      if (f.fit && f.fit !== 'all') {
        if (f.fit === 'none' ? r.fit !== null : r.fit?.fit !== f.fit) return false;
      }
      return true;
    });
    const fitRank = { buen_fit: 0, fit_parcial: 1, no_fit: 3 } as const;
    rows = rows.sort((a, b) => {
      if (f.sort === 'fit') {
        const ra = a.fit ? fitRank[a.fit.fit] : 2, rb = b.fit ? fitRank[b.fit.fit] : 2;
        if (ra !== rb) return ra - rb;
      }
      return b.prospect.createdAt.localeCompare(a.prospect.createdAt);
    });
    const start = (page - 1) * pageSize;
    return { items: rows.slice(start, start + pageSize), total: rows.length, page, pageSize };
  }

  async getProspect(id: string) { await this.gate(); return this.row(id); }

  async getAudit(prospectId: string) {
    await this.gate();
    const D = this.d;
    const ids = new Set<string>([prospectId,
      ...D.evidence.filter((e) => e.prospectId === prospectId).map((e) => e.id),
      ...D.reviews.filter((r) => r.prospectId === prospectId).map((r) => r.id),
      ...D.fits.filter((r) => r.prospectId === prospectId).map((r) => r.id),
      ...D.drafts.filter((r) => r.prospectId === prospectId).map((r) => r.id),
      ...D.followups.filter((r) => r.prospectId === prospectId).map((r) => r.id),
      ...D.opportunities.filter((r) => r.prospectId === prospectId).map((r) => r.id)]);
    return D.audit.filter((a) => ids.has(a.entityId)).sort((a, b) => b.at.localeCompare(a.at));
  }

  async getAgentSteps(prospectId: string) {
    await this.gate();
    const list = this.d.agentSteps.filter((s) => s.prospectId === prospectId);
    if (list.length) return list;
    // aprobado localmente en la demo: la lista aparece con todo pendiente hasta que María la ejecute
    const r = this.row(prospectId);
    if (r?.reviewState !== 'approved') return [];
    const keys: AgentStep['key'][] = ['best_contact', 'warm_paths', 'brief', 'draft_email', 'save_gmail', 'update_pipeline', 'schedule_followups'];
    return keys.map((key, i) => ({ prospectId, key, status: i === 0 ? 'running' as const : 'pending' as const, note: null, at: null }));
  }

  async getDiscardReasons() {
    await this.gate();
    const counts = new Map<string, number>();
    for (const r of this.d.reviews) if (r.decision === 'discard' && r.reason) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);
    return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
  }

  async saveReview(input: { prospectId: string; decision: Decision; reason?: string; revisitOn?: string }) {
    await this.gate();
    if (input.decision === 'discard' && !input.reason?.trim()) throw new AdapterError('unknown', 'Descartar requiere una razón.');
    if (input.decision === 'maybe' && !input.revisitOn) throw new AdapterError('unknown', 'Maybe requiere una fecha para volver.');
    const review: Review = {
      id: `rv_local_${Date.now()}`, prospectId: input.prospectId, decision: input.decision,
      reason: input.reason?.trim() || null, revisitOn: input.revisitOn || null, decidedBy: 'adri', decidedAt: new Date().toISOString(),
    };
    this.data.reviews.push(review);
    const label = input.decision === 'approve_contact' ? 'Contacto aprobado' : input.decision === 'maybe' ? `Maybe: volver el ${input.revisitOn}` : `Descartado: ${review.reason}`;
    this.data.audit.push({ id: `au_${review.id}`, entity: 'review', entityId: review.id, action: label, by: 'adri', at: review.decidedAt });
    this.emit();
    await this.persistence?.saveReview(review);
    return review;
  }

  async saveFit(input: { prospectId: string; fit: FitLevel; services: Offer[]; budget: BudgetSignal; note?: string }) {
    await this.gate();
    if (input.fit !== 'no_fit' && input.services.length === 0) throw new AdapterError('unknown', 'Elige al menos un servicio que encaje.');
    const fit: FitAssessment = {
      id: `ft_${input.prospectId}_${Date.now()}`, prospectId: input.prospectId, fit: input.fit, services: input.fit === 'no_fit' ? [] : input.services,
      budget: input.budget, note: input.note?.trim() || null, decidedBy: 'adri', decidedAt: new Date().toISOString(),
    };
    this.data.fits.push(fit);
    this.data.audit.push({ id: `au_${fit.id}`, entity: 'fit', entityId: fit.id, action: `Fit: ${fit.fit.replace('_', ' ')} · ${fit.services.join(', ') || 'sin servicio'} · presupuesto ${fit.budget.replace('_', ' ')}`, by: 'adri', at: fit.decidedAt });
    this.emit();
    await this.persistence?.saveFit(fit);
    return fit;
  }

  async moveStage(input: { opportunityId: string; stage: Stage }) {
    await this.gate();
    const o = this.data.opportunities.find((x) => x.id === input.opportunityId);
    if (!o) throw new AdapterError('unknown', 'Oportunidad no encontrada.');
    if (o.stage === input.stage) return { ...o };
    o.stage = input.stage; o.updatedAt = new Date().toISOString();
    this.data.audit.push({ id: `au_st_${o.id}_${Date.now()}`, entity: 'opportunity', entityId: o.id, action: `Movido a ${input.stage.replace('_', ' ')} (pendiente de sincronizar con GHL)`, by: 'adri', at: o.updatedAt });
    this.emit();
    await this.persistence?.saveStage({ opportunityId: o.id, stage: input.stage, movedAt: o.updatedAt, by: 'adri' });
    return { ...o };
  }

  async setClosedStep(input: { opportunityId: string; step: 'deposit' | 'delivered' | 'balance'; done: boolean; amountContracted: number; on?: string }) {
    await this.gate();
    const opp = this.data.opportunities.find((o) => o.id === input.opportunityId);
    if (!opp || opp.stage !== 'closed') throw new AdapterError('unknown', 'Los hitos solo se registran en oportunidades Closed.');
    const prev = this.data.payments.find((p) => p.opportunityId === input.opportunityId);
    const when = input.on ? `${input.on}T12:00:00-05:00` : new Date().toISOString();
    const half = Math.round(input.amountContracted * 0.5);
    const pv: PaymentVerification = {
      opportunityId: input.opportunityId, type: prev?.type ?? 'project_50pct', contractSigned: true, amountContracted: input.amountContracted,
      depositVerified: prev?.depositVerified ?? false, verifiedAt: prev?.verifiedAt ?? null, depositReceived: prev?.depositReceived ?? null,
      deliveredAt: prev?.deliveredAt ?? null, balanceVerifiedAt: prev?.balanceVerifiedAt ?? null, balanceReceived: prev?.balanceReceived ?? null, balancePending: null,
    };
    if (input.step === 'deposit') { pv.depositVerified = input.done; pv.verifiedAt = input.done ? when : null; pv.depositReceived = input.done ? half : null; }
    if (input.step === 'delivered') { pv.deliveredAt = input.done ? when : null; }
    if (input.step === 'balance') { pv.balanceVerifiedAt = input.done ? when : null; pv.balanceReceived = input.done ? input.amountContracted - half : null; }
    pv.balancePending = input.amountContracted - (pv.depositReceived ?? 0) - (pv.balanceReceived ?? 0);
    this.data.payments = [...this.data.payments.filter((p) => p.opportunityId !== pv.opportunityId), pv];
    const label = { deposit: 'Anticipo 50%', delivered: 'Entrega', balance: 'Saldo 50%' }[input.step];
    this.data.audit.push({ id: `au_pay_${pv.opportunityId}_${Date.now()}`, entity: 'payment', entityId: pv.opportunityId, action: `${label}: ${input.done ? 'registrado' : 'quitado'}`, by: 'adri', at: new Date().toISOString() });
    this.emit();
    await this.persistence?.savePayment(pv);
    return pv;
  }

  async listDrafts() { await this.gate(); return [...this.d.drafts]; }

  async approveDraft(id: string) {
    await this.gate();
    const dr = this.data.drafts.find((x) => x.id === id);
    if (!dr) throw new AdapterError('unknown', 'Borrador no encontrado.');
    if (dr.status === 'draft') { dr.status = 'approved'; dr.approvedAt = new Date().toISOString(); }
    this.data.audit.push({ id: `au_ap_${dr.id}`, entity: 'draft', entityId: dr.id, action: 'Borrador aprobado', by: 'adri', at: dr.approvedAt! });
    this.emit();
    await this.persistence?.saveDraftApproval(dr.id, dr.approvedAt!);
    return { ...dr };
  }

  async listFollowups() { await this.gate(); return [...this.d.followups]; }

  async listOpportunities() { await this.gate(); return { opportunities: [...this.d.opportunities], payments: [...this.d.payments] }; }

  async getGoalProgress(): Promise<GoalProgress> {
    await this.gate();
    const closed = this.d.opportunities.filter((o) => o.stage === 'closed');
    const verified = closed.filter((o) => this.d.payments.some((p) => p.opportunityId === o.id && p.contractSigned && p.depositVerified));
    const signedPending = closed.filter((o) => this.d.payments.some((p) => p.opportunityId === o.id && p.contractSigned && !p.depositVerified));
    return {
      verifiedSales: verified.length, target: 10, windowStart: GOAL_WINDOW.start, windowEnd: GOAL_WINDOW.end,
      signedPendingDeposit: signedPending.length, updatedAt: this.data.meta.updatedAt, source: this.data.meta.source,
    };
  }

  async getLocalities() { await this.gate(); return [...new Set(this.data.companies.map((c) => c.locality))].sort(); }
  async getMeta() { return this.data.meta; }
}
