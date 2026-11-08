import type { Evidence, EvidenceComponent } from '../data/model';

const COMPONENTS: EvidenceComponent[] = ['social_outdated', 'lower_visibility_vs_competitor', 'competitor_better'];

/** Afirmaciones de caída en el tiempo. La comparación tiene que ser actual, con URL y fecha. */
const LONGITUDINAL = /\b(cay[oó]|declin|ha ca[ií]do|dropped|used to rank|antes aparec|antes rankeaba|baj[oó] en el|longitudinal)/i;

export interface EvidenceInput {
  id: string;
  prospectId: string;
  component: string;
  fact: string;
  url: string;
  observedAt: string;
  competitorUrl?: string | null;
}

export function validateEvidence(input: EvidenceInput): { ok: true; value: Evidence } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(input.id)) issues.push('id');
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(input.prospectId)) issues.push('prospectId');
  if (!COMPONENTS.includes(input.component as EvidenceComponent)) issues.push('component');
  const fact = typeof input.fact === 'string' ? input.fact.trim() : '';
  if (fact.length < 8 || fact.length > 2000) issues.push('fact');
  if (LONGITUDINAL.test(fact)) issues.push('longitudinal_decline');
  if (typeof input.url !== 'string' || !isHttpUrl(input.url)) issues.push('url');
  const observed = new Date(input.observedAt);
  if (Number.isNaN(observed.getTime())) issues.push('observedAt');
  const needsCompetitor = input.component === 'lower_visibility_vs_competitor' || input.component === 'competitor_better';
  const competitor = input.competitorUrl?.trim() || null;
  if (needsCompetitor && !competitor) issues.push('competitor_url');
  if (competitor && !isHttpUrl(competitor)) issues.push('competitor_url');
  if (issues.length) return { ok: false, issues };
  return {
    ok: true,
    value: {
      id: input.id,
      prospectId: input.prospectId,
      component: input.component as EvidenceComponent,
      fact,
      url: input.url.trim(),
      observedAt: observed.toISOString(),
      competitorUrl: competitor,
    },
  };
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
  } catch {
    return false;
  }
}
