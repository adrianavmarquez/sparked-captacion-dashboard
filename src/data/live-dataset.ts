import type { Company, Contact, Dataset, Opportunity, Prospect, Stage } from './model';
import type { StageMove } from './persistence';

export interface LiveGhlOpp {
  id: string;
  stage: Stage | null;
  stageName: string | null;
  outcome: 'unverified' | 'lost';
  ghlStatus: string | null;
  name: string | null;
  updatedAt: string | null;
}

export interface WorkspacePayload {
  companies: Company[];
  prospects: Prospect[];
  evidence: Dataset['evidence'];
  contacts: Contact[];
  reviews: Dataset['reviews'];
  fits: Dataset['fits'];
  payments: Dataset['payments'];
  stages: StageMove[];
  opportunities: LiveGhlOpp[];
  ghlOk: boolean;
  updatedAt: string;
  source: string;
}

export function datasetFromWorkspace(payload: WorkspacePayload): Dataset {
  const companies = [...payload.companies];
  const prospects = [...payload.prospects];
  const known = new Set(prospects.map((prospect) => prospect.id));
  const stageMoves = new Map(payload.stages.map((move) => [move.opportunityId, move]));
  const opportunities: Opportunity[] = payload.opportunities.map((row) => {
    const move = stageMoves.get(row.id);
    const prospectId = safeProspectId(row.id);
    if (!known.has(prospectId)) {
      known.add(prospectId);
      companies.push({
        id: `co_${prospectId}`,
        name: row.name?.trim() || 'Oportunidad GHL',
        locality: 'GHL',
        industry: row.stageName || 'Etapa sin mapa',
        isChainOrFranchise: false,
        websiteUrl: null,
        websiteRenewedOn: null,
        websiteRenewedSource: null,
      });
      prospects.push({
        id: prospectId,
        companyId: `co_${prospectId}`,
        summary: 'Oportunidad leída de GHL. Sin ficha de captación importada.',
        summarySource: 'ghl-read',
        offerInterest: null,
        fit: null,
        budgetSignal: null,
        exclusion: null,
        createdAt: row.updatedAt || payload.updatedAt,
        whyNow: null,
      });
    }
    return {
      id: row.id,
      prospectId,
      stage: move?.stage ?? row.stage ?? 'new_lead',
      source: 'ghl',
      updatedAt: move?.movedAt ?? row.updatedAt ?? payload.updatedAt,
      outcome: row.outcome,
      ghlStatus: row.ghlStatus,
    };
  });
  return {
    companies,
    prospects,
    evidence: payload.evidence,
    contacts: payload.contacts,
    reviews: payload.reviews,
    opportunities,
    payments: payload.payments,
    drafts: [],
    followups: [],
    fits: payload.fits,
    agentSteps: [],
    audit: payload.reviews.map((review) => ({
      id: `au_${review.id}`,
      entity: 'review',
      entityId: review.id,
      action: review.decision,
      by: 'adri' as const,
      at: review.decidedAt,
    })),
    meta: { updatedAt: payload.updatedAt, source: payload.source },
  };
}

export function safeProspectId(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
  return `ghl_${cleaned || 'opp'}`;
}
