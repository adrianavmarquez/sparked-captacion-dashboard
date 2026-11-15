import type { ContactRole, Evidence, EvidenceComponent, Exclusion, Offer } from '../../src/data/model';
import { InputError } from '../validate';

const OBSERVED_AT = '2026-11-15T12:26:00-05:00';
const STATUSES = ['Listo para revisión', 'Revisión manual', 'Descartado'] as const;
export type ImportStatus = (typeof STATUSES)[number];
const COMPONENTS: EvidenceComponent[] = ['social_outdated', 'lower_visibility_vs_competitor', 'competitor_better'];
const EXCLUSIONS: Exclusion[] = ['chain', 'franchise', 'recently_renewed', 'manual_review'];
const ID = /^[A-Za-z0-9_-]{1,80}$/;

export interface CatalogCompany {
  id: string;
  name: string;
  locality: string;
  industry: string;
  isChainOrFranchise: boolean;
  websiteUrl: string | null;
  websiteRenewedOn: string | null;
  websiteRenewedSource: string | null;
  address: string | null;
}

export interface CatalogProspect {
  id: string;
  companyId: string;
  summary: string;
  summarySource: string;
  offerInterest: Offer | null;
  exclusion: Exclusion | null;
  statusProposed: ImportStatus;
  confidence: string | null;
  note: string | null;
  createdAt: string;
}

export interface CatalogContact {
  id: string;
  prospectId: string;
  role: ContactRole;
  channel: 'email' | 'linkedin';
  value: string;
  verified: boolean;
  verifiedAt: string | null;
  source: string | null;
}

export interface PreparedImport {
  companies: CatalogCompany[];
  prospects: CatalogProspect[];
  evidence: Evidence[];
  contacts: CatalogContact[];
}

export interface ImportCounts {
  companies: { inserted: number; updated: number };
  prospects: { inserted: number; updated: number };
  evidence: { inserted: number; updated: number };
  contacts: { inserted: number; updated: number };
  reviewsCreated: number;
  ghlWrites: 'disabled';
}

export function prepareImport(body: unknown): PreparedImport {
  const src = asRecord(body);
  const companiesRaw = asArray(src.companies, 'companies');
  const prospectsRaw = asArray(src.prospects, 'prospects');
  const evidenceRaw = asArray(src.evidence, 'evidence');
  const contactsRaw = asArray(src.contacts, 'contacts');
  const issues: string[] = [];
  const companies = companiesRaw.map((row, index) => companyOf(row, index, issues));
  const companyIds = new Set(companies.map((row) => row.id));
  const prospects = prospectsRaw.map((row, index) => prospectOf(row, index, companyIds, issues));
  const prospectIds = new Set(prospects.map((row) => row.id));
  const evidence = evidenceRaw.map((row, index) => evidenceOf(row, index, prospectIds, issues));
  const contacts = contactsRaw.map((row, index) => contactOf(row, index, prospectIds, issues));
  if (issues.length) throw new InputError(issues.slice(0, 20));
  return { companies, prospects, evidence, contacts };
}

export function discardReason(prospect: CatalogProspect): string {
  const note = prospect.note?.trim();
  if (note) return note.slice(0, 500);
  return 'Descartado en el lote del 15 nov 2026.';
}

function companyOf(row: Record<string, unknown>, index: number, issues: string[]): CatalogCompany {
  const id = textId(row.id, `companies.${index}.id`, issues);
  return {
    id,
    name: text(row.name, `companies.${index}.name`, issues).slice(0, 200),
    locality: text(row.locality, `companies.${index}.locality`, issues).slice(0, 200),
    industry: text(row.industry, `companies.${index}.industry`, issues).slice(0, 120),
    isChainOrFranchise: row.is_chain_or_franchise === true || row.isChainOrFranchise === true,
    websiteUrl: nullable(row.website_url ?? row.websiteUrl),
    websiteRenewedOn: nullable(row.website_renewed_on ?? row.websiteRenewedOn),
    websiteRenewedSource: nullable(row.website_renewed_source ?? row.websiteRenewedSource),
    address: nullable(row.address),
  };
}

function prospectOf(row: Record<string, unknown>, index: number, companies: Set<string>, issues: string[]): CatalogProspect {
  const id = textId(row.id, `prospects.${index}.id`, issues);
  const companyId = textId(row.company_id ?? row.companyId, `prospects.${index}.company`, issues);
  if (companyId && !companies.has(companyId)) issues.push(`prospects.${index}.company`);
  const status = String(row.status_proposed ?? row.statusProposed ?? '');
  if (!STATUSES.includes(status as ImportStatus)) issues.push(`prospects.${index}.status`);
  let exclusion = (row.exclusion ?? null) as Exclusion | null;
  if (exclusion != null && !EXCLUSIONS.includes(exclusion)) issues.push(`prospects.${index}.exclusion`);
  if (status === 'Revisión manual' && exclusion == null) exclusion = 'manual_review';
  const offer = row.offer_interest ?? row.offerInterest ?? null;
  return {
    id,
    companyId,
    summary: text(row.summary, `prospects.${index}.summary`, issues).slice(0, 2000),
    summarySource: text(row.summary_source ?? row.summarySource, `prospects.${index}.source`, issues).slice(0, 2000),
    offerInterest: offer == null ? null : (['diagnostico', 'core', 'plus', 'cm'].includes(String(offer)) ? offer as Offer : null),
    exclusion,
    statusProposed: (STATUSES.includes(status as ImportStatus) ? status : 'Listo para revisión') as ImportStatus,
    confidence: nullable(row.confidence),
    note: nullable(row.note),
    createdAt: OBSERVED_AT,
  };
}

function evidenceOf(row: Record<string, unknown>, index: number, prospects: Set<string>, issues: string[]): Evidence {
  const id = textId(row.id, `evidence.${index}.id`, issues);
  const prospectId = textId(row.prospect_id ?? row.prospectId, `evidence.${index}.prospect`, issues);
  if (prospectId && !prospects.has(prospectId)) issues.push(`evidence.${index}.prospect`);
  const component = String(row.component ?? '');
  if (!COMPONENTS.includes(component as EvidenceComponent)) issues.push(`evidence.${index}.component`);
  const observed = String(row.observed_at ?? row.observedAt ?? '');
  if (Number.isNaN(new Date(observed).getTime())) issues.push(`evidence.${index}.observedAt`);
  const url = String(row.url ?? '');
  if (!/^https?:\/\//.test(url)) issues.push(`evidence.${index}.url`);
  return {
    id,
    prospectId,
    component: component as EvidenceComponent,
    fact: text(row.fact, `evidence.${index}.fact`, issues).slice(0, 2000),
    url,
    observedAt: new Date(observed).toISOString(),
    competitorUrl: nullable(row.competitor_url ?? row.competitorUrl),
  };
}

function contactOf(row: Record<string, unknown>, index: number, prospects: Set<string>, issues: string[]): CatalogContact {
  const id = textId(row.id, `contacts.${index}.id`, issues);
  const prospectId = textId(row.prospect_id ?? row.prospectId, `contacts.${index}.prospect`, issues);
  if (prospectId && !prospects.has(prospectId)) issues.push(`contacts.${index}.prospect`);
  const channel = row.channel === 'linkedin' ? 'linkedin' : row.channel === 'email' ? 'email' : '';
  if (!channel) issues.push(`contacts.${index}.channel`);
  const role = row.role === 'decisor' || row.role === 'ejecutor' || row.role === 'otro' ? row.role : 'otro';
  return {
    id,
    prospectId,
    role,
    channel: channel || 'email',
    value: text(row.value, `contacts.${index}.value`, issues).slice(0, 320),
    verified: row.verified === true,
    verifiedAt: nullable(row.verified_at ?? row.verifiedAt),
    source: nullable(row.source),
  };
}

function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError(['body']);
  return body as Record<string, unknown>;
}

function asArray(value: unknown, field: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new InputError([field]);
  return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
}

function text(value: unknown, field: string, issues: string[]): string {
  if (typeof value !== 'string' || !value.trim()) { issues.push(field); return ''; }
  return value.trim();
}

function textId(value: unknown, field: string, issues: string[]): string {
  const id = typeof value === 'string' ? value : '';
  if (!ID.test(id)) issues.push(field);
  return id;
}

function nullable(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
