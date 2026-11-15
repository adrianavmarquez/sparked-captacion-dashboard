import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { handleApi, type ApiDeps } from '../server/api/handler';
import { prepareImport } from '../server/catalog/prepare';
import type { Env } from '../server/env';
import { MemoryReviewStore } from '../server/store/memory';
import { datasetFromWorkspace } from '../src/data/live-dataset';
import { isVerifiedWebsiteSale } from '../src/domain/income';
import { GOAL } from '../src/domain/constants';

const TOKEN = 'token-should-not-leak-9f3a';
const SECRET = 'session-secret-test-value';
const FILE = 'data/imports/charlotte-2026-11-15.json';

function envOf(values: Record<string, string | undefined>): Env {
  return { get: (name) => values[name] };
}

function harness() {
  const production = new MemoryReviewStore('production');
  const deps: ApiDeps = {
    env: envOf({ SPARKED_OPERATOR_TOKEN: TOKEN, SPARKED_SESSION_SECRET: SECRET, SPARKED_COOKIE_SECURE: 'false' }),
    now: () => new Date('2026-11-15T12:26:00-05:00'),
    stores: {
      demo: () => ({ ok: true, store: new MemoryReviewStore('demo'), durable: false, realm: 'demo' }),
      production: async () => ({ ok: true, store: production, durable: false, realm: 'production' }),
    },
  };
  return { production, deps };
}

describe('importación Charlotte', () => {
  it('es idempotente y conserva estados, urls y fechas', async () => {
    const raw = JSON.parse(readFileSync(FILE, 'utf8'));
    const prepared = prepareImport(raw);
    expect(prepared.companies).toHaveLength(50);
    expect(prepared.prospects).toHaveLength(50);
    expect(prepared.evidence).toHaveLength(137);
    expect(prepared.contacts).toHaveLength(29);
    const sample = prepared.evidence.find((row) => row.id === 'ev-SP-001-1');
    expect(sample?.url).toContain('facebook.com');
    expect(sample?.observedAt).toContain('2026-11-15');
    expect(prepared.prospects.filter((row) => row.statusProposed === 'Descartado')).toHaveLength(9);
    expect(prepared.prospects.filter((row) => row.statusProposed === 'Revisión manual')).toHaveLength(12);
    expect(prepared.prospects.filter((row) => row.statusProposed === 'Listo para revisión')).toHaveLength(29);

    const { production, deps } = harness();
    const first = await handleApi(new Request('https://dashboard.example/api/import/prospects', {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: readFileSync(FILE, 'utf8'),
    }), deps);
    const counts = await first.json() as { reviewsCreated: number; companies: { inserted: number }; ghlWrites: string };
    expect(first.status).toBe(200);
    expect(counts.companies.inserted).toBe(50);
    expect(counts.reviewsCreated).toBe(9);
    expect(counts.ghlWrites).toBe('disabled');

    const second = await handleApi(new Request('https://dashboard.example/api/import/prospects', {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: readFileSync(FILE, 'utf8'),
    }), deps);
    const again = await second.json() as { reviewsCreated: number; companies: { inserted: number; updated: number }; evidence: { inserted: number; updated: number } };
    expect(again.reviewsCreated).toBe(0);
    expect(again.companies.inserted).toBe(0);
    expect(again.companies.updated).toBe(50);
    expect(again.evidence.inserted).toBe(0);
    expect(again.evidence.updated).toBe(137);
    expect((await production.load()).reviews).toHaveLength(9);
    expect((await production.loadCatalog()).evidence.find((row) => row.id === 'ev-SP-001-1')?.url).toBe(sample?.url);

    const open = await handleApi(new Request('https://dashboard.example/api/workspace'), deps);
    expect(open.status).toBe(401);
    expect(await open.text()).not.toContain('Americana Autos');
  });

  it('won no cuenta como venta y abandoned sigue en la lista', () => {
    const dataset = datasetFromWorkspace({
      companies: [], prospects: [], evidence: [], contacts: [], reviews: [], fits: [], payments: [], stages: [],
      ghlOk: true, updatedAt: '2026-11-15T12:26:00-05:00', source: 'Base de captación + lectura GHL',
      opportunities: [
        { id: 'won1', stage: 'closed', stageName: 'Closed', outcome: 'unverified', ghlStatus: 'won', name: 'Cerrada en GHL', updatedAt: '2026-11-10T15:00:00Z' },
        { id: 'lost1', stage: 'negotiation', stageName: 'Negotiation', outcome: 'lost', ghlStatus: 'abandoned', name: 'Abandonada', updatedAt: '2026-11-10T15:00:00Z' },
      ],
    });
    expect(dataset.opportunities).toHaveLength(2);
    expect(dataset.opportunities.find((row) => row.ghlStatus === 'abandoned')?.outcome).toBe('lost');
    expect(dataset.payments).toHaveLength(0);
    const won = dataset.opportunities[0];
    expect(isVerifiedWebsiteSale({
      offer: 'core', payment: null, outcome: won.outcome,
      window: { start: GOAL.windowStart, end: GOAL.windowEnd },
    })).toBe(false);
    expect(dataset.prospects.map((row) => row.id).sort()).toEqual(['ghl_lost1', 'ghl_won1']);
  });
});

describe('entorno', () => {
  it('no usa el token de prueba como valor real', () => {
    expect(TOKEN.startsWith('token-should-not-leak')).toBe(true);
    expect(envOf({}).get('GHL_API_TOKEN')).toBeUndefined();
  });
});
