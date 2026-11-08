import type { Stage } from '../../src/data/model';
import type { Env } from '../env';
import { readEnv } from '../env';
import { redact } from '../redact';
import { STAGE_NAME_TO_KEY } from './candidate';
import { assertGhlMethodIsRead } from './gates';

const DEFAULT_BASE = 'https://services.leadconnectorhq.com';
const MAX_PAGES = 50;
const PAGE_LIMIT = 100;

export interface GhlStage {
  id: string;
  name: string;
  mapped: Stage | null;
}

export interface GhlPipelineCheck {
  id: string;
  name: string;
  verified: boolean;
  stages: GhlStage[];
}

export interface GhlOpportunity {
  id: string;
  pipelineId: string;
  stageId: string;
  stage: Stage | null;
  stageName: string | null;
  /** Siempre unverified: Closed no significa ganado. */
  outcome: 'unverified';
  ghlStatus: string | null;
  updatedAt: string | null;
  /** Valor declarado por GHL. No es caja ni contratado verificado. */
  statedValue: number | null;
  statedValueUse: 'ignored_until_verified';
}

export type GhlResult<T> =
  | { status: 'ok'; data: T; live: true }
  | { status: 'not_configured'; missing: string[]; live: false }
  | { status: 'pipeline_not_verified'; pipelineId: string; live: true }
  | { status: 'error'; code: 'ghl_unauthorized' | 'ghl_error' | 'ghl_bad_page'; live: false };

export interface GhlDeps {
  env: Env;
  fetchImpl?: typeof fetch;
}

export async function ghlStatus(deps: GhlDeps): Promise<GhlResult<GhlPipelineCheck>> {
  const cfg = config(deps.env);
  if (!cfg) return { status: 'not_configured', missing: missing(deps.env), live: false };
  try {
    const body = await ghlGet(cfg, `/opportunities/pipelines?locationId=${encodeURIComponent(cfg.locationId)}`, deps.fetchImpl);
    const pipelines = asArray(body.pipelines);
    const found = pipelines.find((p) => String(p.id ?? '') === cfg.pipelineId);
    if (!found) return { status: 'pipeline_not_verified', pipelineId: cfg.pipelineId, live: true };
    const stages = asArray(found.stages).map((stage) => {
      const name = String(stage.name ?? '');
      return { id: String(stage.id ?? ''), name, mapped: mapStage(name) };
    });
    return { status: 'ok', live: true, data: { id: cfg.pipelineId, name: String(found.name ?? ''), verified: true, stages } };
  } catch (error) {
    return asGhlError(error);
  }
}

export async function ghlOpportunities(deps: GhlDeps): Promise<GhlResult<GhlOpportunity[]>> {
  const status = await ghlStatus(deps);
  if (status.status !== 'ok') return status;
  const cfg = config(deps.env);
  if (!cfg) return { status: 'not_configured', missing: missing(deps.env), live: false };
  const stageById = new Map(status.data.stages.map((stage) => [stage.id, stage]));
  const rows: GhlOpportunity[] = [];
  let startAfter: string | undefined;
  let startAfterId: string | undefined;
  let previousCursor = '';
  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const params = new URLSearchParams({
        location_id: cfg.locationId,
        pipeline_id: cfg.pipelineId,
        limit: String(PAGE_LIMIT),
      });
      if (startAfter) params.set('startAfter', startAfter);
      if (startAfterId) params.set('startAfterId', startAfterId);
      const body = await ghlGet(cfg, `/opportunities/search?${params.toString()}`, deps.fetchImpl);
      const batch = asArray(body.opportunities);
      for (const row of batch) {
        const stageId = String(row.pipelineStageId ?? '');
        const stage = stageById.get(stageId);
        const monetary = typeof row.monetaryValue === 'number' && Number.isFinite(row.monetaryValue) ? row.monetaryValue : null;
        rows.push({
          id: String(row.id ?? ''),
          pipelineId: String(row.pipelineId ?? cfg.pipelineId),
          stageId,
          stage: stage?.mapped ?? null,
          stageName: stage?.name ?? null,
          outcome: 'unverified',
          ghlStatus: row.status == null ? null : String(row.status),
          updatedAt: row.updatedAt == null ? null : String(row.updatedAt),
          statedValue: monetary,
          statedValueUse: 'ignored_until_verified',
        });
      }
      const meta = (body.meta ?? {}) as Record<string, unknown>;
      const nextAfter = meta.startAfter == null ? '' : String(meta.startAfter);
      const nextId = meta.startAfterId == null ? '' : String(meta.startAfterId);
      const cursor = `${nextAfter}|${nextId}`;
      if (batch.length === 0 || !nextId || cursor === previousCursor) break;
      previousCursor = cursor;
      startAfter = nextAfter || undefined;
      startAfterId = nextId;
    }
    return { status: 'ok', live: true, data: rows };
  } catch (error) {
    return asGhlError(error);
  }
}

interface GhlConfig {
  token: string;
  locationId: string;
  pipelineId: string;
  base: string;
}

function config(env: Env): GhlConfig | null {
  const token = readEnv(env, 'GHL_API_TOKEN');
  const locationId = readEnv(env, 'GHL_LOCATION_ID');
  const pipelineId = readEnv(env, 'GHL_PIPELINE_ID');
  if (!token || !locationId || !pipelineId) return null;
  return { token, locationId, pipelineId, base: readEnv(env, 'GHL_BASE_URL') ?? DEFAULT_BASE };
}

function missing(env: Env): string[] {
  return ['GHL_API_TOKEN', 'GHL_LOCATION_ID', 'GHL_PIPELINE_ID'].filter((name) => !readEnv(env, name));
}

class GhlHttpError extends Error {
  constructor(readonly status: number) {
    super(`ghl_${status}`);
  }
}

async function ghlGet(cfg: GhlConfig, path: string, fetchImpl: typeof fetch = fetch): Promise<Record<string, unknown>> {
  assertGhlMethodIsRead('GET');
  const response = await fetchImpl(`${cfg.base}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Version: '2021-07-28',
      Accept: 'application/json',
    },
  });
  if (response.status === 401 || response.status === 403) throw new GhlHttpError(response.status);
  if (!response.ok) throw new GhlHttpError(response.status);
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new GhlHttpError(502);
  }
}

function mapStage(name: string): Stage | null {
  const key = name.trim().toLowerCase();
  return (STAGE_NAME_TO_KEY as Record<string, Stage>)[key] ?? null;
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
}

function asGhlError(error: unknown): GhlResult<never> {
  if (error instanceof GhlHttpError && (error.status === 401 || error.status === 403)) {
    return { status: 'error', code: 'ghl_unauthorized', live: false };
  }
  if (error instanceof GhlHttpError) return { status: 'error', code: 'ghl_error', live: false };
  const message = error instanceof Error ? redact(error.message) : 'ghl_error';
  if (/disabled|write/i.test(message)) return { status: 'error', code: 'ghl_error', live: false };
  return { status: 'error', code: 'ghl_bad_page', live: false };
}
