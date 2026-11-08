import type { BudgetSignal, Decision, FitAssessment, FitLevel, Offer, PaymentVerification, Review, Stage } from '../src/data/model';
import { validateEvidence, type EvidenceInput } from '../src/domain/evidence';
import { isIsoDate, isIsoDateTime } from '../src/domain/time';

const ID = /^[A-Za-z0-9_-]{1,80}$/;
const OFFERS: Offer[] = ['diagnostico', 'core', 'plus', 'cm'];
const FITS: FitLevel[] = ['buen_fit', 'fit_parcial', 'no_fit'];
const BUDGETS: BudgetSignal[] = ['sin_dato', 'bajo', 'rango_core', 'rango_plus', 'abierto'];
const STAGES: Stage[] = ['new_lead', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'closed'];

export class InputError extends Error {
  constructor(readonly issues: string[]) {
    super('validation');
    this.name = 'InputError';
  }
}

function id(value: unknown, issues: string[], field: string) {
  if (typeof value !== 'string' || !ID.test(value)) issues.push(field);
}

function money(value: unknown, issues: string[], field: string): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10_000_000) {
    issues.push(field);
    return null;
  }
  return Math.round(value * 100) / 100;
}

export function parseReview(body: unknown, actor: 'adri', at: string): Review {
  const src = asObject(body);
  const issues: string[] = [];
  id(src.prospectId, issues, 'prospectId');
  const decision = src.decision;
  if (decision !== 'approve_contact' && decision !== 'maybe' && decision !== 'discard') issues.push('decision');
  const reason = src.reason == null ? null : String(src.reason).trim();
  const revisitOn = src.revisitOn == null || src.revisitOn === '' ? null : String(src.revisitOn);
  if (decision === 'discard' && !reason) issues.push('reason');
  if (decision === 'maybe' && (!revisitOn || !isIsoDate(revisitOn))) issues.push('revisitOn');
  if (reason && reason.length > 500) issues.push('reason');
  if (issues.length) throw new InputError(issues);
  const reviewId = typeof src.id === 'string' && ID.test(src.id) ? src.id : `rv_${Date.now()}`;
  return {
    id: reviewId,
    prospectId: String(src.prospectId),
    decision: decision as Decision,
    reason: decision === 'discard' ? reason : reason || null,
    revisitOn: decision === 'maybe' ? revisitOn : null,
    decidedBy: actor,
    decidedAt: at,
  };
}

export function parseFit(body: unknown, actor: 'adri', at: string): FitAssessment {
  const src = asObject(body);
  const issues: string[] = [];
  id(src.prospectId, issues, 'prospectId');
  if (!FITS.includes(src.fit as FitLevel)) issues.push('fit');
  const services = Array.isArray(src.services) ? src.services.filter((item): item is Offer => OFFERS.includes(item as Offer)) : [];
  if (Array.isArray(src.services) && services.length !== src.services.length) issues.push('services');
  if (src.fit !== 'no_fit' && services.length === 0) issues.push('services');
  if (!BUDGETS.includes(src.budget as BudgetSignal)) issues.push('budget');
  const note = src.note == null ? null : String(src.note).trim();
  if (note && note.length > 1000) issues.push('note');
  if (issues.length) throw new InputError(issues);
  const fitId = typeof src.id === 'string' && ID.test(src.id) ? src.id : `ft_${String(src.prospectId)}_${Date.now()}`;
  return {
    id: fitId,
    prospectId: String(src.prospectId),
    fit: src.fit as FitLevel,
    services: src.fit === 'no_fit' ? [] : services,
    budget: src.budget as BudgetSignal,
    note: note || null,
    decidedBy: actor,
    decidedAt: at,
  };
}

export function parsePayment(body: unknown): PaymentVerification & { offer?: Offer | null } {
  const src = asObject(body);
  const issues: string[] = [];
  id(src.opportunityId, issues, 'opportunityId');
  if (src.type !== 'project_50pct' && src.type !== 'monthly_prepaid') issues.push('type');
  if (typeof src.contractSigned !== 'boolean') issues.push('contractSigned');
  const amountContracted = money(src.amountContracted, issues, 'amountContracted');
  const depositReceived = money(src.depositReceived, issues, 'depositReceived');
  const balanceReceived = money(src.balanceReceived, issues, 'balanceReceived');
  const depositVerified = src.depositVerified === true;
  const verifiedAt = src.verifiedAt == null ? null : String(src.verifiedAt);
  const deliveredAt = src.deliveredAt == null ? null : String(src.deliveredAt);
  const balanceVerifiedAt = src.balanceVerifiedAt == null ? null : String(src.balanceVerifiedAt);
  const depositMarkedAt = src.depositMarkedAt == null ? null : String(src.depositMarkedAt);
  const balanceMarkedAt = src.balanceMarkedAt == null ? null : String(src.balanceMarkedAt);
  if (depositVerified && (depositReceived == null || !verifiedAt || !isIsoDateTime(verifiedAt))) issues.push('deposit_not_actual');
  if (balanceVerifiedAt && (balanceReceived == null || !isIsoDateTime(balanceVerifiedAt))) issues.push('balance_not_actual');
  for (const [field, value] of [['verifiedAt', verifiedAt], ['deliveredAt', deliveredAt], ['depositMarkedAt', depositMarkedAt], ['balanceMarkedAt', balanceMarkedAt]] as const) {
    if (value && !isIsoDateTime(value)) issues.push(field);
  }
  const offer = src.offer == null ? null : src.offer;
  if (offer != null && !OFFERS.includes(offer as Offer)) issues.push('offer');
  if (issues.length) throw new InputError(issues);
  return {
    opportunityId: String(src.opportunityId),
    type: src.type as 'project_50pct' | 'monthly_prepaid',
    contractSigned: src.contractSigned === true,
    amountContracted,
    depositVerified,
    verifiedAt: depositVerified ? verifiedAt : null,
    depositReceived: depositVerified ? depositReceived : null,
    balancePending: null,
    deliveredAt,
    balanceVerifiedAt: balanceVerifiedAt && balanceReceived != null ? balanceVerifiedAt : null,
    balanceReceived: balanceVerifiedAt ? balanceReceived : null,
    depositMarkedAt,
    balanceMarkedAt,
    offer: offer as Offer | null,
  };
}

export function parseStage(body: unknown, actor: 'adri', at: string): { opportunityId: string; stage: Stage; movedAt: string; by: 'adri' } {
  const src = asObject(body);
  const issues: string[] = [];
  id(src.opportunityId, issues, 'opportunityId');
  if (!STAGES.includes(src.stage as Stage)) issues.push('stage');
  if (issues.length) throw new InputError(issues);
  return { opportunityId: String(src.opportunityId), stage: src.stage as Stage, movedAt: at, by: actor };
}

export function parseEvidenceBody(body: unknown) {
  const src = asObject(body);
  const result = validateEvidence(src as unknown as EvidenceInput);
  if (!result.ok) throw new InputError(result.issues);
  return result.value;
}

export function parseStop(body: unknown): { prospectId: string; reason: 'replied' | 'opt_out' } {
  const src = asObject(body);
  const issues: string[] = [];
  id(src.prospectId, issues, 'prospectId');
  if (src.reason !== 'replied' && src.reason !== 'opt_out') issues.push('reason');
  if (issues.length) throw new InputError(issues);
  return { prospectId: String(src.prospectId), reason: src.reason as 'replied' | 'opt_out' };
}

export function parseSchedule(body: unknown): { firstSentAt: string | null } {
  const src = asObject(body);
  if (src.firstSentAt == null) return { firstSentAt: null };
  if (typeof src.firstSentAt !== 'string' || !isIsoDateTime(src.firstSentAt)) throw new InputError(['firstSentAt']);
  return { firstSentAt: src.firstSentAt };
}

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError(['body']);
  return body as Record<string, unknown>;
}
