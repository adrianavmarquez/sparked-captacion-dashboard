import type { Dataset } from './model';

/** Catálogo vacío. La sesión real no parte de negocios de ejemplo. */
export function emptyDataset(source = 'Sin sesión'): Dataset {
  return {
    companies: [], prospects: [], evidence: [], contacts: [], reviews: [],
    opportunities: [], payments: [], drafts: [], followups: [], fits: [],
    agentSteps: [], audit: [],
    meta: { updatedAt: new Date(0).toISOString(), source },
  };
}
