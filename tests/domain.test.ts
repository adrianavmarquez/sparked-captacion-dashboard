import { describe, expect, it } from 'vitest';
import { fixtures, GOAL_WINDOW } from '../src/data/fixtures';
import { GOAL } from '../src/domain/constants';
import { exclusionDecision } from '../src/domain/exclusions';
import { validateEvidence } from '../src/domain/evidence';
import { freshnessAt } from '../src/domain/freshness';
import { assertFollowupDoesNotSend, scheduleFollowups, stopSequence } from '../src/domain/followups';
import { expectedProjectDeposit, incomeLine, incomeTotals, isActiveWebProject, isVerifiedWebsiteSale } from '../src/domain/income';
import { closedSemantics, qualificationOf } from '../src/domain/qualification';
import { civilDateInEt } from '../src/domain/time';
import type { PaymentVerification } from '../src/data/model';

const window = { start: GOAL.windowStart, end: GOAL.windowEnd };

function payment(partial: Partial<PaymentVerification>): PaymentVerification {
  return {
    opportunityId: 'op_test', type: 'project_50pct', contractSigned: true, amountContracted: null,
    depositVerified: false, verifiedAt: null, depositReceived: null, balancePending: null,
    deliveredAt: null, balanceVerifiedAt: null, balanceReceived: null, ...partial,
  };
}

describe('fechas ET', () => {
  it('usa el día civil de Nueva York y no el día UTC', () => {
    expect(civilDateInEt('2026-11-08T03:30:00Z')).toBe('2026-11-07');
    expect(civilDateInEt('2026-03-08T03:30:00Z')).toBe('2026-03-07');
  });

  it('suma 4, 10 y 20 días civiles desde el primer envío, también cruzando el DST', () => {
    const acrossFallBack = scheduleFollowups('2026-11-08T03:30:00Z');
    expect(acrossFallBack).toEqual([
      { day: 4, dueOn: '2026-11-11' },
      { day: 10, dueOn: '2026-11-17' },
      { day: 20, dueOn: '2026-11-27' },
    ]);
    const acrossSpring = scheduleFollowups('2026-03-08T03:30:00Z');
    expect(Array.isArray(acrossSpring) && acrossSpring[0]).toEqual({ day: 4, dueOn: '2026-03-11' });
  });

  it('no inventa fechas si no hay envío real', () => {
    expect(scheduleFollowups(null)).toEqual({ error: 'missing_sent_at' });
    expect(() => assertFollowupDoesNotSend()).toThrow(/no se envían/);
  });

  it('coincide con los seguimientos de la demo', () => {
    for (const key of ['B', 'F', 'M'] as const) {
      const sent = fixtures.drafts.find((draft) => draft.id === `dr_${key}_1`)?.sentAt ?? null;
      const plan = scheduleFollowups(sent);
      expect(Array.isArray(plan)).toBe(true);
      if (!Array.isArray(plan)) return;
      for (const day of [4, 10, 20] as const) {
        const fixture = fixtures.followups.find((row) => row.id === `fu_${key}_${day}`);
        expect(plan.find((row) => row.day === day)?.dueOn).toBe(fixture?.dueOn);
      }
    }
  });

  it('respuesta o baja detiene toda la secuencia y no crea un envío', () => {
    const rows = [
      { id: 'a', stopped: false, stopReason: null, status: 'draft' as const },
      { id: 'b', stopped: false, stopReason: null, status: 'approved' as const },
    ];
    const stopped = stopSequence(rows, 'opt_out');
    expect(stopped.every((row) => row.stopped && row.stopReason === 'opt_out')).toBe(true);
    expect(stopped.map((row) => row.status)).toEqual(['draft', 'approved']);
  });
});

describe('ingresos', () => {
  it('no usa precio de lista ni cero cuando falta el monto', () => {
    const line = incomeLine({ offer: 'core', payment: payment({}), stage: 'closed' });
    expect(line.contracted).toBeNull();
    expect(line.paidCash).toBeNull();
    expect(line.balance).toBeNull();
    expect(line.expectedDeposit).toBeNull();
    expect(line.countsTowardWebsiteGoal).toBe(false);
  });

  it('separa contratado, anticipo esperado y caja', () => {
    const line = incomeLine({
      offer: 'core',
      stage: 'closed',
      payment: payment({ amountContracted: 2850 }),
    });
    expect(line.contracted).toBe(2850);
    expect(line.expectedDeposit).toBe(expectedProjectDeposit(2850));
    expect(line.expectedRule).toBe('project_50pct');
    expect(line.paidCash).toBeNull();
    expect(line.countsTowardWebsiteGoal).toBe(false);
  });

  it('el 50% exigido no cuenta como pago recibido', () => {
    const marked = payment({ amountContracted: 2850, depositMarkedAt: '2026-11-20T15:00:00-05:00' });
    expect(isVerifiedWebsiteSale({ offer: 'core', payment: marked, window })).toBe(false);
    const assumed = payment({ amountContracted: 2850, depositReceived: 1425, depositVerified: false });
    expect(isVerifiedWebsiteSale({ offer: 'core', payment: assumed, window })).toBe(false);
  });

  it('cuenta una web solo con firma, caja real, fecha y ventana', () => {
    const paid = payment({
      amountContracted: 2850, depositVerified: true, depositReceived: 1425, verifiedAt: '2026-12-01T15:00:00-05:00',
    });
    expect(isVerifiedWebsiteSale({ offer: 'core', payment: paid, window })).toBe(true);
    expect(isVerifiedWebsiteSale({ offer: 'cm', payment: { ...paid, type: 'monthly_prepaid', depositReceived: 4000, amountContracted: 4000 }, window })).toBe(false);
    expect(isVerifiedWebsiteSale({ offer: 'plus', payment: { ...paid, verifiedAt: '2027-03-01T15:00:00-05:00' }, window })).toBe(false);
    expect(isVerifiedWebsiteSale({ offer: 'core', payment: { ...paid, depositReceived: 100 }, window })).toBe(false);
    expect(isVerifiedWebsiteSale({ offer: 'core', payment: { ...paid, depositReceived: 0 }, window })).toBe(false);
  });

  it('un retainer exige el primer mes, no el 50%', () => {
    const half = payment({ type: 'monthly_prepaid', amountContracted: 4000, depositVerified: true, depositReceived: 2000, verifiedAt: '2026-12-01T15:00:00-05:00' });
    expect(isVerifiedWebsiteSale({ offer: 'core', payment: half, window })).toBe(false);
    const full = { ...half, depositReceived: 4000 };
    expect(isVerifiedWebsiteSale({ offer: 'core', payment: full, window })).toBe(true);
    expect(incomeLine({ offer: 'cm', payment: full }).expectedRule).toBe('retainer_first_month');
    expect(incomeLine({ offer: 'cm', payment: full }).expectedDeposit).toBe(4000);
  });

  it('la capacidad web no suma CM ni un anticipo sin caja', () => {
    expect(isActiveWebProject({ offer: 'cm', stage: 'closed', payment: payment({ depositVerified: true, depositReceived: 4000, verifiedAt: '2026-12-01T15:00:00-05:00', type: 'monthly_prepaid', amountContracted: 4000 }) })).toBe(false);
    expect(isActiveWebProject({ offer: 'core', stage: 'closed', payment: payment({ amountContracted: 2850, depositVerified: true }) })).toBe(false);
    expect(isActiveWebProject({
      offer: 'core', stage: 'closed',
      payment: payment({ amountContracted: 2850, depositVerified: true, depositReceived: 1500, verifiedAt: '2026-12-01T15:00:00-05:00' }),
    })).toBe(true);
  });

  it('un total vacío es cero oportunidades; un monto ausente no es cero', () => {
    expect(incomeTotals([])).toEqual({ contracted: 0, paidCash: 0, balance: 0 });
    const unknown = incomeLine({ offer: 'core', payment: payment({ amountContracted: 2850 }) });
    expect(incomeTotals([unknown]).paidCash).toBeNull();
  });

  it('la ventana de la meta coincide con los fixtures', () => {
    expect(GOAL_WINDOW).toEqual({ start: GOAL.windowStart, end: GOAL.windowEnd });
  });
});

describe('calificación, cierre y evidencia', () => {
  it('Qualified exige fit e interés confirmado', () => {
    expect(qualificationOf({ fit: 'buen_fit', interestConfirmed: true }).qualified).toBe(true);
    expect(qualificationOf({ fit: 'fit_parcial', interestConfirmed: true }).qualified).toBe(true);
    expect(qualificationOf({ fit: 'no_fit', interestConfirmed: true }).qualified).toBe(false);
    expect(qualificationOf({ fit: 'buen_fit', interestConfirmed: null }).qualified).toBe(false);
    expect(qualificationOf({ fit: null, interestConfirmed: null }).missing).toEqual(['offer_fit', 'confirmed_interest']);
  });

  it('Closed no se asume ganado', () => {
    expect(closedSemantics('closed', 'won')).toEqual({ outcome: 'unverified', assumedWon: false });
  });

  it('la evidencia compara el presente y rechaza una caída inventada', () => {
    const ok = validateEvidence({
      id: 'ev_1', prospectId: 'pr_1', component: 'lower_visibility_vs_competitor',
      fact: 'Hoy aparece después del competidor. Comparación del día, sin línea base histórica.',
      url: 'https://buscador.ejemplo.invalid/q', observedAt: '2026-11-01T15:00:00-05:00',
      competitorUrl: 'https://competidor.ejemplo.invalid',
    });
    expect(ok.ok).toBe(true);
    const decline = validateEvidence({
      id: 'ev_2', prospectId: 'pr_1', component: 'social_outdated',
      fact: 'Su visibilidad cayó durante el último año.',
      url: 'https://social.ejemplo.invalid/a', observedAt: '2026-11-01T15:00:00-05:00',
    });
    expect(decline.ok).toBe(false);
    const missingCompetitor = validateEvidence({
      id: 'ev_3', prospectId: 'pr_1', component: 'competitor_better',
      fact: 'El competidor local publica cada semana.',
      url: 'https://competidor.ejemplo.invalid', observedAt: '2026-11-01T15:00:00-05:00',
    });
    expect(missingCompetitor.ok).toBe(false);
  });

  it('frescura a los 7 y 30 días', () => {
    const clock = new Date('2026-11-07T15:00:00-05:00');
    expect(freshnessAt('2026-11-01T15:00:00-05:00', clock)).toBe('fresca');
    expect(freshnessAt('2026-10-30T15:00:00-05:00', clock)).toBe('revalidar');
    expect(freshnessAt('2026-10-01T15:00:00-05:00', clock)).toBe('obsoleta');
  });

  it('excluye cadenas, franquicias y renovaciones con fecha', () => {
    expect(exclusionDecision({ exclusion: 'chain' }).blocked).toBe(true);
    expect(exclusionDecision({ exclusion: 'franchise' }).blocked).toBe(true);
    expect(exclusionDecision({ exclusion: null, isChainOrFranchise: true }).blocked).toBe(true);
    expect(exclusionDecision({
      exclusion: 'recently_renewed', websiteRenewedOn: '2026-10-20', websiteRenewedSource: 'https://ejemplo.invalid/nueva',
    }).blocked).toBe(true);
    expect(exclusionDecision({ exclusion: 'recently_renewed', websiteRenewedOn: null, websiteRenewedSource: null }).manualReview).toBe(true);
    expect(exclusionDecision({ exclusion: 'manual_review' }).blocked).toBe(false);
  });
});
