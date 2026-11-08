import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Evidence, FitAssessment, Offer, PaymentVerification, Review } from '../../src/data/model';
import type { StageMove } from '../../src/data/persistence';
import { centsToDollars, dollarsToCents } from '../../src/domain/income';
import type { SqlDb } from '../db/sql';
import { applySqlMigrations } from '../db/sql';
import type { FollowupStop, ReviewStore, StoredState } from './types';

const MIGRATION_ID = '20261108000000_review_state';

export function migrationSql(): { id: string; sql: string } {
  const sql = readFileSync(path.join(process.cwd(), 'netlify/database/migrations/20261108000000_review_state/migration.sql'), 'utf8');
  return { id: MIGRATION_ID, sql };
}

/** Postgres de producción. Rechaza el reino demo para no mezclarlo con datos reales. */
export class SqlReviewStore implements ReviewStore {
  readonly realm = 'production' as const;
  readonly durable = true;

  constructor(private readonly db: SqlDb, realm: string) {
    if (realm !== 'production') throw new Error('El reino demo no puede usar la base de producción.');
  }

  static async migrate(db: SqlDb) {
    await applySqlMigrations(db, [migrationSql()]);
  }

  async load(): Promise<StoredState> {
    const [reviews, fits, approvals, payments, stages, evidence, stops] = await Promise.all([
      this.db.query<Record<string, unknown>>('SELECT * FROM reviews ORDER BY decided_at ASC'),
      this.db.query<Record<string, unknown>>('SELECT * FROM fit_assessments ORDER BY decided_at ASC'),
      this.db.query<{ draft_id: string; approved_at: string | Date }>('SELECT draft_id, approved_at FROM draft_approvals'),
      this.db.query<Record<string, unknown>>('SELECT * FROM payments'),
      this.db.query<Record<string, unknown>>('SELECT * FROM stage_moves'),
      this.db.query<Record<string, unknown>>('SELECT * FROM evidence'),
      this.db.query<Record<string, unknown>>('SELECT * FROM followup_stops'),
    ]);
    return {
      reviews: reviews.map(mapReview),
      fits: fits.map(mapFit),
      draftApprovals: Object.fromEntries(approvals.map((row) => [row.draft_id, iso(row.approved_at)])),
      payments: payments.map(mapPayment),
      stages: stages.map(mapStage),
      evidence: evidence.map(mapEvidence),
      followupStops: stops.map((row) => ({
        prospectId: String(row.prospect_id),
        reason: row.reason === 'opt_out' ? 'opt_out' : 'replied',
        stoppedAt: iso(row.stopped_at),
      })),
    };
  }

  async saveReview(review: Review) {
    await this.db.query(
      `INSERT INTO reviews (id, prospect_id, decision, reason, revisit_on, decided_by, decided_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [review.id, review.prospectId, review.decision, review.reason, review.revisitOn, review.decidedBy, review.decidedAt],
    );
    await this.audit('review', review.id, review.decision, review.decidedBy, review.decidedAt);
  }

  async saveFit(fit: FitAssessment) {
    await this.db.query(
      `INSERT INTO fit_assessments (id, prospect_id, fit, services, budget, note, decided_by, decided_at)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)`,
      [fit.id, fit.prospectId, fit.fit, JSON.stringify(fit.services), fit.budget, fit.note, fit.decidedBy, fit.decidedAt],
    );
    await this.audit('fit', fit.id, fit.fit, fit.decidedBy, fit.decidedAt);
  }

  async saveDraftApproval(draftId: string, approvedAt: string) {
    await this.db.query(
      `INSERT INTO draft_approvals (draft_id, approved_at) VALUES ($1,$2)
       ON CONFLICT (draft_id) DO UPDATE SET approved_at = EXCLUDED.approved_at`,
      [draftId, approvedAt],
    );
    await this.audit('draft', draftId, 'approved', 'adri', approvedAt);
  }

  async savePayment(payment: PaymentVerification) {
    const offer = (payment as PaymentVerification & { offer?: Offer | null }).offer ?? null;
    await this.db.query(
      `INSERT INTO payments (
         opportunity_id, type, contract_signed, amount_contracted_cents, deposit_verified, verified_at,
         deposit_received_cents, deposit_marked_at, delivered_at, balance_verified_at, balance_received_cents,
         balance_marked_at, offer
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (opportunity_id) DO UPDATE SET
         type = EXCLUDED.type,
         contract_signed = EXCLUDED.contract_signed,
         amount_contracted_cents = EXCLUDED.amount_contracted_cents,
         deposit_verified = EXCLUDED.deposit_verified,
         verified_at = EXCLUDED.verified_at,
         deposit_received_cents = EXCLUDED.deposit_received_cents,
         deposit_marked_at = EXCLUDED.deposit_marked_at,
         delivered_at = EXCLUDED.delivered_at,
         balance_verified_at = EXCLUDED.balance_verified_at,
         balance_received_cents = EXCLUDED.balance_received_cents,
         balance_marked_at = EXCLUDED.balance_marked_at,
         offer = EXCLUDED.offer`,
      [
        payment.opportunityId, payment.type, payment.contractSigned, cents(payment.amountContracted),
        payment.depositVerified, payment.verifiedAt, cents(payment.depositReceived), payment.depositMarkedAt ?? null,
        payment.deliveredAt, payment.balanceVerifiedAt, cents(payment.balanceReceived), payment.balanceMarkedAt ?? null, offer,
      ],
    );
    await this.audit('payment', payment.opportunityId, payment.depositVerified ? 'deposit_recorded' : 'milestone', 'adri', new Date().toISOString());
  }

  async saveStage(move: StageMove) {
    await this.db.query(
      `INSERT INTO stage_moves (opportunity_id, stage, moved_at, moved_by, ghl_synced)
       VALUES ($1,$2,$3,$4,false)
       ON CONFLICT (opportunity_id) DO UPDATE SET stage = EXCLUDED.stage, moved_at = EXCLUDED.moved_at, moved_by = EXCLUDED.moved_by, ghl_synced = false`,
      [move.opportunityId, move.stage, move.movedAt, move.by],
    );
    await this.audit('opportunity', move.opportunityId, `stage:${move.stage}`, move.by, move.movedAt);
  }

  async saveEvidence(evidence: Evidence) {
    await this.db.query(
      `INSERT INTO evidence (id, prospect_id, component, fact, url, observed_at, competitor_url, recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET fact = EXCLUDED.fact, url = EXCLUDED.url, observed_at = EXCLUDED.observed_at, competitor_url = EXCLUDED.competitor_url`,
      [evidence.id, evidence.prospectId, evidence.component, evidence.fact, evidence.url, evidence.observedAt, evidence.competitorUrl, new Date().toISOString()],
    );
  }

  async stopFollowups(stop: FollowupStop) {
    await this.db.query(
      `INSERT INTO followup_stops (prospect_id, reason, stopped_at) VALUES ($1,$2,$3)
       ON CONFLICT (prospect_id) DO UPDATE SET reason = EXCLUDED.reason, stopped_at = EXCLUDED.stopped_at`,
      [stop.prospectId, stop.reason, stop.stoppedAt],
    );
  }

  private async audit(entity: string, entityId: string, action: string, actor: string, at: string) {
    await this.db.query(
      'INSERT INTO audit_log (id, entity, entity_id, action, actor, at) VALUES ($1,$2,$3,$4,$5,$6)',
      [`au_${entity}_${entityId}_${Date.now()}`, entity, entityId, action, actor, at],
    );
  }
}

function cents(value: number | null | undefined): number | null {
  if (value == null) return null;
  return dollarsToCents(value);
}

function dateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
  return match ? match[1] : null;
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const t = new Date(value);
    if (!Number.isNaN(t.getTime())) return t.toISOString();
  }
  throw new Error('Fecha de base inválida.');
}

function mapReview(row: Record<string, unknown>): Review {
  return {
    id: String(row.id),
    prospectId: String(row.prospect_id),
    decision: row.decision as Review['decision'],
    reason: row.reason == null ? null : String(row.reason),
    revisitOn: dateOnly(row.revisit_on),
    decidedBy: 'adri',
    decidedAt: iso(row.decided_at),
  };
}

function mapFit(row: Record<string, unknown>): FitAssessment {
  const services = typeof row.services === 'string' ? JSON.parse(row.services) : row.services;
  return {
    id: String(row.id),
    prospectId: String(row.prospect_id),
    fit: row.fit as FitAssessment['fit'],
    services: Array.isArray(services) ? services as FitAssessment['services'] : [],
    budget: row.budget as FitAssessment['budget'],
    note: row.note == null ? null : String(row.note),
    decidedBy: 'adri',
    decidedAt: iso(row.decided_at),
  };
}

function mapPayment(row: Record<string, unknown>): PaymentVerification & { offer?: Offer | null } {
  return {
    opportunityId: String(row.opportunity_id),
    type: row.type as PaymentVerification['type'],
    contractSigned: row.contract_signed === true || row.contract_signed === 't',
    amountContracted: centsToDollars(row.amount_contracted_cents == null ? null : Number(row.amount_contracted_cents)),
    depositVerified: row.deposit_verified === true || row.deposit_verified === 't',
    verifiedAt: row.verified_at == null ? null : iso(row.verified_at),
    depositReceived: centsToDollars(row.deposit_received_cents == null ? null : Number(row.deposit_received_cents)),
    balancePending: null,
    deliveredAt: row.delivered_at == null ? null : iso(row.delivered_at),
    balanceVerifiedAt: row.balance_verified_at == null ? null : iso(row.balance_verified_at),
    balanceReceived: centsToDollars(row.balance_received_cents == null ? null : Number(row.balance_received_cents)),
    depositMarkedAt: row.deposit_marked_at == null ? null : iso(row.deposit_marked_at),
    balanceMarkedAt: row.balance_marked_at == null ? null : iso(row.balance_marked_at),
    offer: row.offer == null ? null : row.offer as Offer,
  };
}

function mapStage(row: Record<string, unknown>): StageMove {
  return {
    opportunityId: String(row.opportunity_id),
    stage: row.stage as StageMove['stage'],
    movedAt: iso(row.moved_at),
    by: 'adri',
  };
}

function mapEvidence(row: Record<string, unknown>): Evidence {
  return {
    id: String(row.id),
    prospectId: String(row.prospect_id),
    component: row.component as Evidence['component'],
    fact: String(row.fact),
    url: String(row.url),
    observedAt: iso(row.observed_at),
    competitorUrl: row.competitor_url == null ? null : String(row.competitor_url),
  };
}
