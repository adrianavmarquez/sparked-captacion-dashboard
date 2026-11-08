/**
 * Modelo de datos SOLO de front-end. Espejo de modelo-datos.json del paquete.
 * No describe una API existente. Niveles: confirmado / propuesto / pendiente (ver comentarios).
 */

export type Offer = 'diagnostico' | 'core' | 'plus' | 'cm';
export type Exclusion = 'chain' | 'franchise' | 'recently_renewed' | 'manual_review';
export type EvidenceComponent = 'social_outdated' | 'lower_visibility_vs_competitor' | 'competitor_better';
export type Freshness = 'fresca' | 'revalidar' | 'obsoleta';
export type Channel = 'email' | 'linkedin';
export type ContactRole = 'decisor' | 'ejecutor' | 'otro';
export type Decision = 'approve_contact' | 'maybe' | 'discard';
export type Stage = 'new_lead' | 'contacted' | 'qualified' | 'proposal_sent' | 'negotiation' | 'closed';
export type DraftKind = 'first_contact' | 'followup';
export type DraftStatus = 'draft' | 'approved' | 'sent';
export type FollowupDay = 4 | 10 | 20;
export type Actor = 'adri' | 'chiri' | 'maria';

/** Etapa de revisión de Adri (propuesto): derivada de reviews. */
export type ReviewState = 'pending' | 'approved' | 'maybe' | 'discarded';

export interface Company {
  id: string;
  name: string; // ficticio
  locality: string;
  industry: string;
  isChainOrFranchise: boolean;
  websiteUrl: string | null;
  websiteRenewedOn: string | null; // ISO date
  websiteRenewedSource: string | null; // url de la fuente de la fecha
}

export interface Prospect {
  id: string;
  companyId: string;
  summary: string;
  summarySource: string;
  offerInterest: Offer | null;
  /** [PENDIENTE] fit: no se infiere. */
  fit: null;
  /** [PENDIENTE] presupuesto: no se infiere. */
  budgetSignal: null;
  exclusion: Exclusion | null;
  createdAt: string; // ISO datetime ET
  /** [PROPUESTO 7 nov] Por qué contactar ahora: hecho con fecha y fuente. Lo alimenta María. */
  whyNow: { fact: string; date: string; source: string } | null;
}

export interface Evidence {
  id: string;
  prospectId: string;
  component: EvidenceComponent;
  fact: string;
  url: string;
  observedAt: string; // ISO datetime ET
  competitorUrl: string | null;
}

export interface Contact {
  id: string;
  prospectId: string;
  role: ContactRole;
  channel: Channel;
  value: string; // ficticio
  verified: boolean;
  verifiedAt: string | null;
  /** [PROPUESTO 7 nov] camino cálido (conexiones en común, intro posible). Lo alimenta María. */
  warmPath: string | null;
}

export interface Review {
  id: string;
  prospectId: string;
  decision: Decision;
  reason: string | null; // propuesto: obligatoria si discard
  revisitOn: string | null; // propuesto: obligatoria si maybe
  decidedBy: 'adri';
  decidedAt: string;
}

export interface Opportunity {
  id: string;
  prospectId: string;
  stage: Stage;
  source: 'ghl';
  updatedAt: string;
}

export interface PaymentVerification {
  opportunityId: string;
  type: 'project_50pct' | 'monthly_prepaid';
  contractSigned: boolean;
  depositVerified: boolean;
  verifiedAt: string | null;
  amountContracted: number | null;
  depositReceived: number | null;
  balancePending: number | null;
  /** [PROPUESTO 7 nov, pedido por Adri] hitos posteriores al cierre */
  deliveredAt: string | null;
  balanceVerifiedAt: string | null;
  balanceReceived: number | null;
  /** Fecha en que se marcó el hito en el dashboard. No es prueba de caja. */
  depositMarkedAt?: string | null;
  balanceMarkedAt?: string | null;
  /** Oferta asociada al guardar el hito. CM no entra en la meta de webs. */
  offer?: Offer | null;
}

export interface Draft {
  id: string;
  prospectId: string;
  kind: DraftKind;
  followupDay: FollowupDay | null;
  channel: Channel;
  subject: string;
  body: string;
  status: DraftStatus;
  approvedAt: string | null;
  sentAt: string | null; // solo envío efectivo por una persona
}

export interface Followup {
  id: string;
  prospectId: string;
  day: FollowupDay;
  dueOn: string; // = sentAt del primer contacto + day
  stopped: boolean;
  stopReason: 'replied' | 'opt_out' | null;
  draftId: string | null;
}

/** [PROPUESTO] Valoración de fit y presupuesto hecha por Adri. Opciones propuestas; no se infieren. */
export type FitLevel = 'buen_fit' | 'fit_parcial' | 'no_fit';
export type BudgetSignal = 'sin_dato' | 'bajo' | 'rango_core' | 'rango_plus' | 'abierto';
export interface FitAssessment {
  id: string;
  prospectId: string;
  fit: FitLevel;
  services: Offer[];
  budget: BudgetSignal;
  note: string | null;
  decidedBy: 'adri';
  decidedAt: string;
}

/** [PROPUESTO 7 nov] Pasos que ejecuta María tras la aprobación del contacto. */
export type AgentStepKey = 'best_contact' | 'warm_paths' | 'brief' | 'draft_email' | 'save_gmail' | 'update_pipeline' | 'schedule_followups';
export type AgentStepStatus = 'pending' | 'running' | 'done' | 'blocked';
export interface AgentStep {
  prospectId: string;
  key: AgentStepKey;
  status: AgentStepStatus;
  note: string | null;
  at: string | null;
}

export interface AuditEvent {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  by: Actor;
  at: string;
}

export interface Dataset {
  companies: Company[];
  prospects: Prospect[];
  evidence: Evidence[];
  contacts: Contact[];
  reviews: Review[];
  opportunities: Opportunity[];
  payments: PaymentVerification[];
  drafts: Draft[];
  followups: Followup[];
  fits: FitAssessment[];
  agentSteps: AgentStep[];
  audit: AuditEvent[];
  /** Fecha y fuente de la última actualización del conjunto. */
  meta: { updatedAt: string; source: string };
}

/** Vista compuesta para listas y fichas. */
export interface ProspectRow {
  prospect: Prospect;
  company: Company;
  evidence: Evidence[];
  contacts: Contact[];
  review: Review | null;
  fit: FitAssessment | null;
  reviewState: ReviewState;
  freshness: Freshness | 'sin_evidencia';
  opportunity: Opportunity | null;
}

export interface GoalProgress {
  verifiedSales: number;
  target: 10;
  windowStart: string;
  windowEnd: string;
  signedPendingDeposit: number;
  updatedAt: string;
  source: string;
}

export interface ProspectFilters {
  query?: string;
  offer?: Offer | 'all';
  reviewState?: ReviewState | 'all';
  locality?: string | 'all';
  freshness?: Freshness | 'sin_evidencia' | 'all';
  exclusion?: Exclusion | 'none' | 'all';
  fit?: FitLevel | 'none' | 'all';
  sort?: 'recent' | 'fit';
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
