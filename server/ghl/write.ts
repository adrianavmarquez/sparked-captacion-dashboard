import type { Stage } from '../../src/data/model';
import { STAGE_NAME_TO_KEY } from './candidate';
import type { GhlDeps, GhlOpportunity } from './readonly';
import { ghlOpportunities, ghlOutcome, ghlStatus } from './readonly';
import { assertGhlWritesEnabled, GhlScopeError } from './gates';
import { readEnv } from '../env';
import { redact } from '../redact';

const DEFAULT_BASE = 'https://services.leadconnectorhq.com';
const KEY_TO_NAME: Record<Stage, string> = {
  new_lead: 'new lead',
  contacted: 'contacted',
  qualified: 'qualified',
  proposal_sent: 'proposal sent',
  negotiation: 'negotiation',
  closed: 'closed',
};

export type GhlStatusName = 'open' | 'won' | 'lost' | 'abandoned';

export interface GhlWriteSnapshot {
  opportunity: GhlOpportunity;
  contactId: string | null;
}

interface Cfg {
  token: string;
  locationId: string;
  pipelineId: string;
  base: string;
}

function cfgOf(deps: GhlDeps): Cfg {
  const token = readEnv(deps.env, 'GHL_API_TOKEN');
  const locationId = readEnv(deps.env, 'GHL_LOCATION_ID');
  const pipelineId = readEnv(deps.env, 'GHL_PIPELINE_ID');
  if (!token || !locationId || !pipelineId) {
    throw new GhlScopeError('opportunities.write');
  }
  return { token, locationId, pipelineId, base: readEnv(deps.env, 'GHL_BASE_URL') ?? DEFAULT_BASE };
}

function stageId(stages: { id: string; name: string }[], stage: Stage): string {
  const wanted = KEY_TO_NAME[stage];
  const found = stages.find((row) => row.name.trim().toLowerCase() === wanted);
  if (!found?.id) throw new Error(`La etapa ${stage} no está en el pipeline configurado.`);
  return found.id;
}

export async function createGhlOpportunity(deps: GhlDeps, input: {
  name: string;
  stage: Stage;
  status: GhlStatusName;
  monetaryValue: number | null;
  contact: { name: string; email: string; company: string };
}): Promise<GhlWriteSnapshot> {
  assertGhlWritesEnabled(deps.env);
  const cfg = cfgOf(deps);
  const pipelines = await ghlStatus(deps);
  if (pipelines.status !== 'ok') throw new Error('No se pudo leer el pipeline antes de escribir.');
  const contactId = await upsertContact(deps, cfg, input.contact);
  const created = await ghlWrite(deps, cfg, 'POST', '/opportunities/', 'opportunities.write', {
    pipelineId: cfg.pipelineId,
    locationId: cfg.locationId,
    name: input.name,
    pipelineStageId: stageId(pipelines.data.stages, input.stage),
    status: input.status,
    contactId,
    ...(input.monetaryValue == null ? {} : { monetaryValue: input.monetaryValue }),
  });
  const id = pickId(created);
  if (!id) throw new Error('GHL no devolvió la oportunidad.');
  const opportunity = await reread(deps, id);
  return { opportunity, contactId };
}

export async function updateGhlOpportunity(deps: GhlDeps, id: string, patch: {
  name?: string;
  stage?: Stage;
  status?: GhlStatusName;
  monetaryValue?: number | null;
}): Promise<{ before: GhlOpportunity; after: GhlOpportunity }> {
  assertGhlWritesEnabled(deps.env);
  const cfg = cfgOf(deps);
  const before = await reread(deps, id);
  if (before.pipelineId && before.pipelineId !== cfg.pipelineId) {
    throw new Error('La oportunidad no está en el pipeline configurado.');
  }
  const pipelines = await ghlStatus(deps);
  if (pipelines.status !== 'ok') throw new Error('No se pudo leer el pipeline antes de escribir.');
  const body: Record<string, unknown> = { pipelineId: cfg.pipelineId };
  if (patch.name) body.name = patch.name;
  if (patch.status) body.status = patch.status;
  if (patch.stage) body.pipelineStageId = stageId(pipelines.data.stages, patch.stage);
  if (patch.monetaryValue != null) body.monetaryValue = patch.monetaryValue;
  await ghlWrite(deps, cfg, 'PUT', `/opportunities/${encodeURIComponent(id)}`, 'opportunities.write', body);
  const after = await reread(deps, id);
  return { before, after };
}

export async function addGhlNote(deps: GhlDeps, contactId: string, body: string): Promise<void> {
  assertGhlWritesEnabled(deps.env);
  const cfg = cfgOf(deps);
  await ghlWrite(deps, cfg, 'POST', `/contacts/${encodeURIComponent(contactId)}/notes`, 'contacts.write', { body });
}

async function upsertContact(deps: GhlDeps, cfg: Cfg, contact: { name: string; email: string; company: string }): Promise<string> {
  const created = await ghlWrite(deps, cfg, 'POST', '/contacts/upsert', 'contacts.write', {
    locationId: cfg.locationId,
    email: contact.email,
    name: contact.name,
    companyName: contact.company,
  });
  const id = pickId(created);
  if (!id) throw new Error('GHL no devolvió el contacto.');
  return id;
}

async function reread(deps: GhlDeps, id: string): Promise<GhlOpportunity> {
  const list = await ghlOpportunities(deps);
  if (list.status !== 'ok') throw new Error('No se pudo releer GHL después de escribir.');
  const found = list.data.find((row) => row.id === id);
  if (!found) throw new Error('La oportunidad no apareció al releer GHL.');
  if (found.outcome !== ghlOutcome(found.ghlStatus)) found.outcome = ghlOutcome(found.ghlStatus);
  return found;
}

async function ghlWrite(deps: GhlDeps, cfg: Cfg, method: 'POST' | 'PUT', path: string, scope: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (body.locationId && body.locationId !== cfg.locationId) throw new Error('La ubicación no coincide.');
  const response = await (deps.fetchImpl ?? fetch)(`${cfg.base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Version: '2021-07-28',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (response.status === 401 || response.status === 403) throw new GhlScopeError(scopeNamed(text, scope));
  if (!response.ok) throw new Error(redact(`GHL respondió ${response.status}.`));
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('GHL devolvió una página que no se pudo leer.');
  }
}

function scopeNamed(text: string, fallback: string): string {
  const named = text.match(/[a-z]+(?:\.[a-z]+){1,3}/i);
  if (named && /write|readonly|scope/i.test(text)) return named[0];
  try {
    const body = JSON.parse(text) as { scope?: unknown; message?: unknown };
    if (typeof body.scope === 'string' && body.scope.trim()) return body.scope.trim();
    if (typeof body.message === 'string') {
      const inside = body.message.match(/[a-z]+(?:\.[a-z]+){1,3}/i);
      if (inside) return inside[0];
    }
  } catch { /* el texto ya se revisó */ }
  return fallback;
}

function pickId(body: Record<string, unknown>): string {
  if (typeof body.id === 'string') return body.id;
  const nested = body.opportunity ?? body.contact ?? body.note;
  if (nested && typeof nested === 'object' && typeof (nested as { id?: unknown }).id === 'string') {
    return (nested as { id: string }).id;
  }
  return '';
}

export function stageKey(name: string | null): Stage | null {
  if (!name) return null;
  return (STAGE_NAME_TO_KEY as Record<string, Stage>)[name.trim().toLowerCase()] ?? null;
}
