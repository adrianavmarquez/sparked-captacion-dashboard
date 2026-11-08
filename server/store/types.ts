import type { Evidence, FitAssessment, PaymentVerification, Review, Stage } from '../../src/data/model';
import type { SavedState, StageMove } from '../../src/data/persistence';

export interface FollowupStop {
  prospectId: string;
  reason: 'replied' | 'opt_out';
  stoppedAt: string;
}

export interface StoredState extends SavedState {
  evidence: Evidence[];
  followupStops: FollowupStop[];
}

export interface ReviewStore {
  readonly realm: 'production' | 'demo';
  readonly durable: boolean;
  load(): Promise<StoredState>;
  saveReview(review: Review): Promise<void>;
  saveFit(fit: FitAssessment): Promise<void>;
  saveDraftApproval(draftId: string, approvedAt: string): Promise<void>;
  savePayment(payment: PaymentVerification): Promise<void>;
  saveStage(move: StageMove): Promise<void>;
  saveEvidence(evidence: Evidence): Promise<void>;
  stopFollowups(stop: FollowupStop): Promise<void>;
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
  return { reviews: [], fits: [], draftApprovals: {}, payments: [], stages: [], evidence: [], followupStops: [] };
}

export function isStage(value: string): value is Stage {
  return ['new_lead', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'closed'].includes(value);
}
