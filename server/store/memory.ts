import type { Evidence, FitAssessment, PaymentVerification, Review } from '../../src/data/model';
import type { StageMove } from '../../src/data/persistence';
import { emptyState, type FollowupStop, type ReviewStore, type StoredState } from './types';

/** Almacén de un solo proceso. La demo y producción no comparten la instancia. */
export class MemoryReviewStore implements ReviewStore {
  readonly durable = false;
  private state: StoredState = emptyState();

  constructor(readonly realm: 'production' | 'demo') {}

  async load() {
    return structuredClone(this.state);
  }

  async saveReview(review: Review) {
    this.state.reviews.push(structuredClone(review));
  }

  async saveFit(fit: FitAssessment) {
    this.state.fits.push(structuredClone(fit));
  }

  async saveDraftApproval(draftId: string, approvedAt: string) {
    this.state.draftApprovals[draftId] = approvedAt;
  }

  async savePayment(payment: PaymentVerification) {
    this.state.payments = [...this.state.payments.filter((row) => row.opportunityId !== payment.opportunityId), structuredClone(payment)];
  }

  async saveStage(move: StageMove) {
    this.state.stages = [...this.state.stages.filter((row) => row.opportunityId !== move.opportunityId), { ...move }];
  }

  async saveEvidence(evidence: Evidence) {
    this.state.evidence = [...this.state.evidence.filter((row) => row.id !== evidence.id), structuredClone(evidence)];
  }

  async stopFollowups(stop: FollowupStop) {
    this.state.followupStops = [...this.state.followupStops.filter((row) => row.prospectId !== stop.prospectId), { ...stop }];
  }
}
