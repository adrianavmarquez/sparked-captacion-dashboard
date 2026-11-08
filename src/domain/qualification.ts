import type { FitLevel, Offer, Stage } from '../data/model';

export type SaleOutcome = 'unverified';

/** Qualified = encaja la oferta + interés confirmado. El nombre de etapa no basta. */
export function qualificationOf(input: { fit: FitLevel | null; interestConfirmed: boolean | null }): { qualified: boolean; missing: string[] } {
  const missing: string[] = [];
  if (input.fit !== 'buen_fit' && input.fit !== 'fit_parcial') missing.push('offer_fit');
  if (input.interestConfirmed !== true) missing.push('confirmed_interest');
  return { qualified: missing.length === 0, missing };
}

export function isWebsiteOffer(offer: Offer | null | undefined): offer is 'diagnostico' | 'core' | 'plus' {
  return offer === 'diagnostico' || offer === 'core' || offer === 'plus';
}

/**
 * Closed en GHL no se trata como ganado ni perdido.
 * El estado won/lost del conector queda sin verificar en esta versión.
 */
export function closedSemantics(_stage: Stage | string, _ghlStatus?: string | null): { outcome: SaleOutcome; assumedWon: false } {
  return { outcome: 'unverified', assumedWon: false };
}
