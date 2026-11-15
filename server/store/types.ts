import type { Evidence, FitAssessment, PaymentVerification, Review, Stage } from '../../src/data/model';
import type { SavedState, StageMove } from '../../src/data/persistence';
import type { CatalogCompany, CatalogContact, CatalogProspect, ImportCounts, PreparedImport } from '../catalog/prepare';

export interface FollowupStop {
  prospectId: string;
  reason: 'replied' | 'opt_out';
  stoppedAt: string;
}

export interface MailDraft {
  id: string;
  prospectId: string;
  kind: 'first_contact' | 'followup';
  followupDay: 4 | 10 | 20 | null;
  subject: string;
  body: string;
  status: 'draft' | 'approved' | 'sent';
  recipient: string | null;
  messageId: string | null;
  approvedAt: string | null;
  sentAt: string | null;
}

export interface OptOut {
  id: string;
  email: string | null;
  domain: string | null;
  at: string;
  by: 'adri';
}

export interface GhlLink {
  prospectId: string;
  opportunityId: string;
  contactId: string | null;
  locationId: string;
}

export interface GhlAudit {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  actor: string;
  at: string;
  before: unknown;
  after: unknown;
}

export interface StoredState extends SavedState {
  evidence: Evidence[];
  followupStops: FollowupStop[];
  mailDrafts: MailDraft[];
  optOuts: OptOut[];
  ghlLinks: GhlLink[];
  audits: GhlAudit[];
}

export interface CatalogSnapshot {
  companies: CatalogCompany[];
  prospects: CatalogProspect[];
  evidence: Evidence[];
  contacts: CatalogContact[];
}

export interface ReviewStore {
  readonly realm: 'production' | 'demo';
  readonly durable: boolean;
  load(): Promise<StoredState>;
  saveReview(review: Review): Promise<void>;
  saveFit(fit: FitAssessment): Promise<void>;
  saveDraftApproval(draftId: string, approvedAt: string): Promise<void>;
  savePayment(payment: PaymentVerification): Promise<void>;
  saveStage(move: StageMove & { ghlSynced?: boolean }): Promise<void>;
  saveEvidence(evidence: Evidence): Promise<void>;
  stopFollowups(stop: FollowupStop): Promise<void>;
  loadCatalog(): Promise<CatalogSnapshot>;
  importProspects(batch: PreparedImport): Promise<ImportCounts>;
  saveMailDraft(draft: MailDraft): Promise<void>;
  reserveSend(draftId: string, claim: string): Promise<'reserved' | 'sent' | 'missing' | 'busy'>;
  completeSend(draftId: string, messageId: string, sentAt: string, recipient: string): Promise<MailDraft | null>;
  releaseSend(draftId: string, claim: string): Promise<void>;
  countSendsOn(day: string): Promise<number>;
  addOptOut(row: OptOut): Promise<void>;
  saveGhlLink(link: GhlLink): Promise<void>;
  recordAudit(entry: GhlAudit): Promise<void>;
}

export interface StoreHandle {
  ok: true;
  store: ReviewStore;
  durable: boolean;
  realm: 'production' | 'demo';
}

export interface StoreUnavailable {
  ok: false;
  error: 'persistence_not_configured' | 'persistence_unavailable';
}

export type StoreResult = StoreHandle | StoreUnavailable;

export function emptyState(): StoredState {
  return {
    reviews: [], fits: [], draftApprovals: {}, payments: [], stages: [], evidence: [], followupStops: [],
    mailDrafts: [], optOuts: [], ghlLinks: [], audits: [],
  };
}

export function isStage(value: string): value is Stage {
  return ['new_lead', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'closed'].includes(value);
}
