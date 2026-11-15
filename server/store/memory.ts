import type { Evidence, FitAssessment, PaymentVerification, Review } from '../../src/data/model';
import type { StageMove } from '../../src/data/persistence';
import type { ImportCounts, PreparedImport } from '../catalog/prepare';
import { emptyCatalog, importIntoCatalog, type CatalogSnapshot } from '../catalog/apply';
import { emptyState, type FollowupStop, type ReviewStore, type StoredState } from './types';

/** Almacén de un solo proceso. La demo y producción no comparten la instancia. */
export class MemoryReviewStore implements ReviewStore {
  readonly durable = false;
  private state: StoredState = emptyState();
  private catalog: CatalogSnapshot = emptyCatalog();

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

  async loadCatalog() {
    return structuredClone(this.catalog);
  }

  async importProspects(batch: PreparedImport): Promise<ImportCounts> {
    if (this.realm !== 'production') throw new Error('La demo no importa el catálogo de producción.');
    const result = importIntoCatalog(this.catalog, this.state.reviews, batch);
    this.catalog = result.catalog;
    for (const review of result.reviews) this.state.reviews.push(review);
    return result.counts;
  }
}
