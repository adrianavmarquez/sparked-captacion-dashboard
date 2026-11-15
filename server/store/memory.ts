import type { Evidence, FitAssessment, PaymentVerification, Review } from '../../src/data/model';
import { civilDateInEt } from '../../src/domain/time';
import type { StageMove } from '../../src/data/persistence';
import type { ImportCounts, PreparedImport } from '../catalog/prepare';
import { emptyCatalog, importIntoCatalog, type CatalogSnapshot } from '../catalog/apply';
import { emptyState, type FollowupStop, type GhlAudit, type GhlLink, type MailDraft, type OptOut, type ReviewStore, type StoredState } from './types';

/** Almacén de un solo proceso. La demo y producción no comparten la instancia. */
export class MemoryReviewStore implements ReviewStore {
  readonly durable = false;
  private state: StoredState = emptyState();
  private catalog: CatalogSnapshot = emptyCatalog();
  private sendClaims = new Map<string, string>();

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

  async saveStage(move: StageMove & { ghlSynced?: boolean }) {
    this.state.stages = [...this.state.stages.filter((row) => row.opportunityId !== move.opportunityId), { opportunityId: move.opportunityId, stage: move.stage, movedAt: move.movedAt, by: move.by }];
  }

  async saveEvidence(evidence: Evidence) {
    this.state.evidence = [...this.state.evidence.filter((row) => row.id !== evidence.id), structuredClone(evidence)];
  }

  async stopFollowups(stop: FollowupStop) {
    this.state.followupStops = [...this.state.followupStops.filter((row) => row.prospectId !== stop.prospectId), { ...stop }];
  }

  async saveMailDraft(draft: MailDraft) {
    const next = structuredClone(draft);
    this.state.mailDrafts = [...this.state.mailDrafts.filter((row) => row.id !== draft.id), next];
  }

  async reserveSend(draftId: string, claim: string): Promise<'reserved' | 'sent' | 'missing' | 'busy'> {
    const row = this.state.mailDrafts.find((item) => item.id === draftId);
    if (!row) return 'missing';
    if (row.status === 'sent') return 'sent';
    const current = this.sendClaims.get(draftId);
    if (current && current !== claim) return 'busy';
    this.sendClaims.set(draftId, claim);
    return 'reserved';
  }

  async completeSend(draftId: string, messageId: string, sentAt: string, recipient: string): Promise<MailDraft | null> {
    const row = this.state.mailDrafts.find((item) => item.id === draftId);
    if (!row) return null;
    row.status = 'sent';
    row.messageId = messageId;
    row.sentAt = sentAt;
    row.approvedAt = row.approvedAt ?? sentAt;
    row.recipient = recipient;
    this.state.draftApprovals[draftId] = row.approvedAt;
    this.sendClaims.delete(draftId);
    return structuredClone(row);
  }

  async releaseSend(draftId: string, claim: string) {
    if (this.sendClaims.get(draftId) === claim) this.sendClaims.delete(draftId);
  }

  async countSendsOn(day: string) {
    return this.state.mailDrafts.filter((row) => row.status === 'sent' && !!row.sentAt && civilDateInEt(row.sentAt) === day).length;
  }

  async addOptOut(row: OptOut) {
    const same = this.state.optOuts.some((item) => (row.email && item.email === row.email) || (row.domain && item.domain === row.domain));
    if (!same) this.state.optOuts.push({ ...row });
  }

  async saveGhlLink(link: GhlLink) {
    this.state.ghlLinks = [...this.state.ghlLinks.filter((row) => row.prospectId !== link.prospectId), { ...link }];
  }

  async recordAudit(entry: GhlAudit) {
    this.state.audits.push(structuredClone(entry));
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
