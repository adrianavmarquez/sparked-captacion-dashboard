import type { Offer, PaymentVerification, Stage } from '../data/model';
import { GOAL } from './constants';
import { isWebsiteOffer } from './qualification';
import { civilDateInEt } from './time';

export interface IncomeLine {
  contracted: number | null;
  expectedDeposit: number | null;
  expectedRule: 'project_50pct' | 'retainer_first_month' | 'unknown';
  paidCash: number | null;
  balance: number | null;
  unknowns: string[];
  countsTowardWebsiteGoal: boolean;
  outcome: 'unverified';
}

function roundCents(dollars: number): number {
  return Math.round(dollars * 100) / 100;
}

/** Mitad exigida del proyecto. Es un requisito, no caja recibida. */
export function expectedProjectDeposit(contracted: number): number {
  return roundCents(contracted * 0.5);
}

export function dollarsToCents(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Monto inválido.');
  const cents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - cents) > 1e-6) throw new Error('Monto inválido.');
  return cents;
}

export function centsToDollars(cents: number | null): number | null {
  if (cents == null) return null;
  return cents / 100;
}

function knownMoney(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return roundCents(value);
}

/**
 * Separa valor contratado, caja cobrada y anticipo esperado.
 * Un monto ausente queda null. No se rellena con 0 ni con precio de lista.
 * El 50% exigido no prueba que el pago entró.
 */
export function incomeLine(input: {
  offer: Offer | null;
  stage?: Stage | null;
  payment: PaymentVerification | null;
  window?: { start: string; end: string };
}): IncomeLine {
  const payment = input.payment;
  const contracted = knownMoney(payment?.amountContracted);
  const unknowns: string[] = [];
  if (!payment || contracted == null) unknowns.push('contracted');

  const retainer = payment?.type === 'monthly_prepaid' || input.offer === 'cm';
  const expectedRule = contracted == null ? 'unknown' : retainer ? 'retainer_first_month' : 'project_50pct';
  const expectedDeposit = contracted == null ? null : retainer ? contracted : expectedProjectDeposit(contracted);
  if (expectedDeposit == null) unknowns.push('expected_deposit');

  const depositCash = payment?.depositVerified ? knownMoney(payment.depositReceived) : null;
  const balanceCash = payment?.balanceVerifiedAt ? knownMoney(payment.balanceReceived) : null;
  if (payment?.depositVerified && depositCash == null) unknowns.push('deposit_amount');
  if (payment?.balanceVerifiedAt && balanceCash == null) unknowns.push('balance_amount');
  if (payment?.depositVerified && !payment.verifiedAt) unknowns.push('deposit_date');

  let paidCash: number | null = null;
  const verifiedBits = [depositCash, balanceCash].filter((n): n is number => n != null);
  const broken = (payment?.depositVerified && (depositCash == null || !payment.verifiedAt))
    || (!!payment?.balanceVerifiedAt && balanceCash == null);
  if (!broken && verifiedBits.length > 0) {
    paidCash = roundCents(verifiedBits.reduce((sum, n) => sum + n, 0));
  } else if (payment && !payment.depositVerified && !payment.balanceVerifiedAt) {
    unknowns.push('paid_cash');
  } else {
    unknowns.push('paid_cash');
  }

  const balance = contracted != null && paidCash != null ? roundCents(contracted - paidCash) : null;
  if (balance == null) unknowns.push('balance');

  return {
    contracted,
    expectedDeposit,
    expectedRule,
    paidCash,
    balance,
    unknowns,
    countsTowardWebsiteGoal: isVerifiedWebsiteSale({
      offer: input.offer,
      payment,
      window: input.window ?? { start: GOAL.windowStart, end: GOAL.windowEnd },
    }),
    outcome: 'unverified',
  };
}

export function isVerifiedWebsiteSale(input: {
  offer: Offer | null;
  payment: PaymentVerification | null;
  window: { start: string; end: string };
}): boolean {
  const { payment } = input;
  if (!isWebsiteOffer(input.offer)) return false;
  if (!payment?.contractSigned) return false;
  if (!payment.depositVerified || payment.depositReceived == null || !payment.verifiedAt) return false;
  if (payment.amountContracted == null) return false;
  const required = payment.type === 'monthly_prepaid' ? payment.amountContracted : expectedProjectDeposit(payment.amountContracted);
  if (payment.depositReceived < required) return false;
  let paidOn: string;
  try { paidOn = civilDateInEt(payment.verifiedAt); } catch { return false; }
  return paidOn >= input.window.start && paidOn <= input.window.end;
}

export function isActiveWebProject(input: {
  offer: Offer | null;
  stage: Stage;
  payment: PaymentVerification | null;
}): boolean {
  if (!isWebsiteOffer(input.offer)) return false;
  if (input.stage !== 'closed') return false;
  const payment = input.payment;
  if (!payment?.depositVerified || payment.depositReceived == null || !payment.verifiedAt) return false;
  if (payment.deliveredAt) return false;
  return true;
}

export function incomeTotals(lines: IncomeLine[]): { contracted: number | null; paidCash: number | null; balance: number | null } {
  if (lines.length === 0) return { contracted: 0, paidCash: 0, balance: 0 };
  const sum = (values: (number | null)[]) => values.some((v) => v == null) ? null : values.reduce<number>((acc, v) => acc + (v as number), 0);
  return {
    contracted: sum(lines.map((l) => l.contracted)),
    paidCash: sum(lines.map((l) => l.paidCash)),
    balance: sum(lines.map((l) => l.balance)),
  };
}
