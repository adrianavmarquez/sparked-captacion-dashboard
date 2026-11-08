import type { Exclusion } from '../data/model';
import { isIsoDate } from './time';
import { isHttpUrl } from './evidence';

/**
 * Cadenas y franquicias no se contactan.
 * Web recién renovada solo cuenta si hay fecha y fuente.
 * Sin fecha verificable queda en revisión manual, no se descarta sola.
 */
export function exclusionDecision(input: {
  exclusion: Exclusion | null;
  isChainOrFranchise?: boolean;
  websiteRenewedOn?: string | null;
  websiteRenewedSource?: string | null;
}): { blocked: boolean; manualReview: boolean; reason: string | null } {
  if (input.isChainOrFranchise || input.exclusion === 'chain' || input.exclusion === 'franchise') {
    return { blocked: true, manualReview: false, reason: input.exclusion === 'franchise' ? 'franchise' : 'chain' };
  }
  if (input.exclusion === 'recently_renewed') {
    const dated = !!input.websiteRenewedOn && isIsoDate(input.websiteRenewedOn) && !!input.websiteRenewedSource && isHttpUrl(input.websiteRenewedSource);
    if (!dated) return { blocked: false, manualReview: true, reason: 'renewed_without_source_date' };
    return { blocked: true, manualReview: false, reason: 'recently_renewed' };
  }
  if (input.exclusion === 'manual_review') return { blocked: false, manualReview: true, reason: 'manual_review' };
  return { blocked: false, manualReview: false, reason: null };
}
