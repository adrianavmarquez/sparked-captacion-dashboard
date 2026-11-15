import { describe, expect, it } from 'vitest';
import { handleApi, type ApiDeps } from '../server/api/handler';
import type { Env } from '../server/env';
import type { Mailer } from '../server/mail/smtp';
import { MemoryReviewStore } from '../server/store/memory';
import { renderSparkedEmail } from '../server/email/render';

const TOKEN = 'token-adri';
const CHIRI = 'token-chiri';
const SECRET = 'session-secret-test-value';
const PIPE = 'pipe_test';
const LOCATION = 'loc_test';

function envOf(values: Record<string, string | undefined>): Env {
  return { get: (name) => values[name] };
}

function harness(extra: Record<string, string | undefined> = {}, fetchImpl?: typeof fetch, mailer?: Mailer) {
  const production = new MemoryReviewStore('production');
  const deps: ApiDeps = {
    env: envOf({
      SPARKED_OPERATOR_TOKEN: TOKEN,
      SPARKED_OPERATOR_TOKEN_CHIRI: CHIRI,
      SPARKED_SESSION_SECRET: SECRET,
      SPARKED_COOKIE_SECURE: 'false',
      GHL_API_TOKEN: 'ghl-token',
      GHL_LOCATION_ID: LOCATION,
      GHL_PIPELINE_ID: PIPE,
      GMAIL_SENDER: 'adriana@sparkedreactions.com',
      GMAIL_APP_PASSWORD: 'app-password-value',
      ...extra,
    }),
    now: () => new Date('2026-11-15T15:00:00-05:00'),
    fetchImpl,
    mailer,
    stores: {
      demo: () => ({ ok: true, store: new MemoryReviewStore('demo'), durable: false, realm: 'demo' }),
      production: async () => ({ ok: true, store: production, durable: false, realm: 'production' }),
    },
  };
  return { production, deps };
}

function call(deps: ApiDeps, path: string, init: RequestInit = {}, token = TOKEN) {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  if (init.body) headers.set('content-type', 'application/json');
  return handleApi(new Request(`https://dashboard.example${path}`, { ...init, headers }), deps);
}

const catalog = {
  companies: [{ id: 'co_1', name: 'Aarushi Salon', locality: 'East Forest, Charlotte, NC', industry: 'Beauty salon', is_chain_or_franchise: false, website_url: null, website_renewed_on: null, website_renewed_source: null, address: null }],
  prospects: [{ id: 'pr_1', company_id: 'co_1', summary: 'Sitio viejo.', summary_source: 'https://maps.example/a', offer_interest: 'core', exclusion: null, status_proposed: 'Listo para revisión', confidence: null, note: null }],
  evidence: [],
  contacts: [{ id: 'ct_1', prospect_id: 'pr_1', role: 'decisor', channel: 'email', value: 'owner@taller.test', verified: true, verified_at: null, source: 'https://maps.example/a' }],
};

function pipelineBody() {
  return JSON.stringify({ pipelines: [{ id: PIPE, name: 'Marketing', stages: [{ id: 'st_new', name: 'New Lead' }, { id: 'st_qual', name: 'Qualified' }] }] });
}

describe('envíos y escrituras', () => {
  it('con las banderas apagadas no envía ni escribe, y la salud lo dice', async () => {
    let sent = false;
    let wrote = false;
    const mailer: Mailer = { send: async () => { sent = true; return { messageId: 'x' }; }, verify: async () => undefined };
    const { deps } = harness({}, async (_input, init) => { if (init?.method && init.method !== 'GET') wrote = true; return new Response('{"pipelines":[]}', { status: 200 }); }, mailer);
    const health = await handleApi(new Request('https://dashboard.example/api/health'), deps);
    const flags = await health.json() as { sends: string; ghlWrites: string };
    expect(flags.sends).toBe('disabled');
    expect(flags.ghlWrites).toBe('disabled');
    await call(deps, '/api/import/prospects', { method: 'POST', body: JSON.stringify(catalog) });
    const review = await call(deps, '/api/reviews', { method: 'POST', body: JSON.stringify({ prospectId: 'pr_1', decision: 'approve_contact' }) });
    const created = await review.json() as { draft: { id: string } };
    const approved = await call(deps, `/api/drafts/${created.draft.id}/approve`, { method: 'POST', body: JSON.stringify({ confirm: true }) });
    const body = await approved.json() as { send: string; message: string; sentAt: string | null };
    expect(approved.status).toBe(200);
    expect(body.send).toBe('disabled');
    expect(body.sentAt).toBeNull();
    expect(body.message).toContain('Pendiente de activar');
    expect(sent).toBe(false);
    expect(wrote).toBe(false);
  });

  it('Chiri recibe 403 y no dispara el correo', async () => {
    const mailer: Mailer = { send: async () => { throw new Error('no'); }, verify: async () => undefined };
    const { deps } = harness({ SPARKED_SENDS: 'enabled', SPARKED_GHL_WRITES: 'enabled' }, undefined, mailer);
    for (const path of ['/api/email/verify', '/api/drafts/dr_1/approve', '/api/ghl/opportunities', '/api/opt-outs', '/api/stages']) {
      const response = await call(deps, path, { method: 'POST', body: JSON.stringify({ prospectId: 'pr_1', email: 'a@b.co', opportunityId: 'op', stage: 'qualified' }) }, CHIRI);
      expect(response.status).toBe(403);
    }
  });

  it('Aprobar envía una sola vez, con html y texto, y el tope y la baja frenan el resto', async () => {
    const sent: { to: string; html: string; text: string; subject: string }[] = [];
    const mailer: Mailer = {
      async send(message) { sent.push(message); return { messageId: `<m${sent.length}@sparkedreactions.com>` }; },
      async verify() { return undefined; },
    };
    const { production, deps } = harness({ SPARKED_SENDS: 'enabled' }, undefined, mailer);
    await call(deps, '/api/import/prospects', { method: 'POST', body: JSON.stringify(catalog) });
    const review = await call(deps, '/api/reviews', { method: 'POST', body: JSON.stringify({ prospectId: 'pr_1', decision: 'approve_contact' }) });
    const draftId = ((await review.json()) as { draft: { id: string; subject: string; body: string } }).draft.id;
    const state = await production.load();
    const draft = state.mailDrafts.find((row) => row.id === draftId)!;
    const preview = await call(deps, `/api/drafts/${draftId}/approve`, { method: 'POST', body: '{}' });
    expect(preview.status).toBe(409);
    const first = await call(deps, `/api/drafts/${draftId}/approve`, { method: 'POST', body: JSON.stringify({ confirm: true, subject: draft.subject, body: draft.body }) });
    expect(first.status).toBe(200);
    const payload = await first.json() as { messageId: string; idempotent: boolean; status: string };
    expect(payload.status).toBe('sent');
    expect(payload.idempotent).toBe(false);
    const expected = renderSparkedEmail({ subject: draft.subject, body: draft.body, lang: 'en', level: 'cotidiano' });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('owner@taller.test');
    expect(sent[0].html).toBe(expected.html);
    expect(sent[0].text).toBe(expected.text);
    expect(sent[0].html).toContain('Adriana V. Márquez');
    const again = await call(deps, `/api/drafts/${draftId}/approve`, { method: 'POST', body: JSON.stringify({ confirm: true }) });
    expect((await again.json() as { idempotent: boolean }).idempotent).toBe(true);
    expect(sent).toHaveLength(1);
    const followups = (await production.load()).mailDrafts.filter((row) => row.kind === 'followup');
    expect(followups.map((row) => row.followupDay).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([4, 10, 20]);
    await call(deps, '/api/opt-outs', { method: 'POST', body: JSON.stringify({ email: 'owner@taller.test' }) });
    const blocked = await call(deps, `/api/drafts/${followups[0].id}/approve`, { method: 'POST', body: JSON.stringify({ confirm: true }) });
    expect(blocked.status).toBe(409);
    expect((await blocked.json() as { error: string }).error).toBe('opt_out');
    expect(sent).toHaveLength(1);
  });

  it('el tope diario corta el segundo envío', async () => {
    const sent: string[] = [];
    const mailer: Mailer = {
      async send() { sent.push('x'); return { messageId: `<cap${sent.length}@sparked>` }; },
      async verify() { return undefined; },
    };
    const second = {
      ...catalog,
      companies: [...catalog.companies, { ...catalog.companies[0], id: 'co_2', name: 'Otro Taller' }],
      prospects: [...catalog.prospects, { ...catalog.prospects[0], id: 'pr_2', company_id: 'co_2' }],
      contacts: [...catalog.contacts, { ...catalog.contacts[0], id: 'ct_2', prospect_id: 'pr_2', value: 'other@taller.test' }],
    };
    const { deps } = harness({ SPARKED_SENDS: 'enabled', SPARKED_DAILY_SEND_CAP: '1' }, undefined, mailer);
    await call(deps, '/api/import/prospects', { method: 'POST', body: JSON.stringify(second) });
    const firstReview = await call(deps, '/api/reviews', { method: 'POST', body: JSON.stringify({ prospectId: 'pr_1', decision: 'approve_contact' }) });
    const secondReview = await call(deps, '/api/reviews', { method: 'POST', body: JSON.stringify({ prospectId: 'pr_2', decision: 'approve_contact' }) });
    const firstId = ((await firstReview.json()) as { draft: { id: string } }).draft.id;
    const secondId = ((await secondReview.json()) as { draft: { id: string } }).draft.id;
    expect((await call(deps, `/api/drafts/${firstId}/approve`, { method: 'POST', body: JSON.stringify({ confirm: true }) })).status).toBe(200);
    const capped = await call(deps, `/api/drafts/${secondId}/approve`, { method: 'POST', body: JSON.stringify({ confirm: true }) });
    expect(capped.status).toBe(429);
    expect(sent).toHaveLength(1);
  });

  it('verifica el SMTP sin enviar y no devuelve la clave', async () => {
    let sent = 0;
    const mailer: Mailer = {
      send: async () => { sent += 1; return { messageId: 'x' }; },
      verify: async () => { throw new Error('login failed for app-password-value'); },
    };
    const { deps } = harness({}, undefined, mailer);
    const response = await call(deps, '/api/email/verify', { method: 'POST', body: '{}' });
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain('app-password-value');
    expect(sent).toBe(0);
  });

  it('si el token no tiene alcance, el mensaje lo nombra y won no es una venta', async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/pipelines')) return new Response(pipelineBody(), { status: 200 });
      if (init?.method === 'POST' && url.endsWith('/contacts/upsert')) return new Response(JSON.stringify({ contact: { id: 'contact_1' } }), { status: 200 });
      if (init?.method === 'POST' && url.includes('/opportunities')) {
        return new Response(JSON.stringify({ message: 'missing opportunities.write scope' }), { status: 401 });
      }
      if (url.includes('/opportunities/search')) {
        return new Response(JSON.stringify({ opportunities: [{ id: 'opp_1', pipelineId: PIPE, pipelineStageId: 'st_qual', status: 'won', name: 'Aarushi', monetaryValue: 10, updatedAt: '2026-11-15T15:00:00-05:00' }] }), { status: 200 });
      }
      if (init?.method === 'PUT') return new Response(JSON.stringify({ opportunity: { id: 'opp_1' } }), { status: 200 });
      return new Response('{}', { status: 200 });
    };
    const { production, deps } = harness({ SPARKED_GHL_WRITES: 'enabled' }, fetchImpl);
    await call(deps, '/api/import/prospects', { method: 'POST', body: JSON.stringify(catalog) });
    const denied = await call(deps, '/api/ghl/opportunities', { method: 'POST', body: JSON.stringify({ prospectId: 'pr_1', stage: 'new_lead', status: 'open', monetaryValue: 10 }) });
    expect(denied.status).toBe(403);
    const scope = await denied.json() as { scope: string; message: string };
    expect(scope.scope).toContain('opportunities.write');
    expect(scope.message).toContain('opportunities.write');
    const moved = await call(deps, '/api/ghl/opportunities/opp_1', { method: 'POST', body: JSON.stringify({ status: 'won', stage: 'qualified' }) });
    expect(moved.status).toBe(200);
    const body = await moved.json() as { opportunity: { outcome: string; ghlStatus: string }; verifiedSale: boolean };
    expect(body.opportunity.ghlStatus).toBe('won');
    expect(body.opportunity.outcome).toBe('unverified');
    expect(body.verifiedSale).toBe(false);
    expect((await production.load()).payments).toHaveLength(0);
    const audit = (await production.load()).audits.find((row) => row.action === 'update');
    expect(audit?.before).toBeTruthy();
    expect(audit?.after).toBeTruthy();
    expect(audit?.actor).toBe('adri');
  });
});
