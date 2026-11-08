import { describe, expect, it } from 'vitest';
import { handleApi, type ApiDeps } from '../server/api/handler';
import { createDefaultDeps } from '../server/api/deps';
import type { Env } from '../server/env';
import { UNVERIFIED_PIPELINE_CANDIDATE } from '../server/ghl/candidate';
import { ghlOpportunities, ghlStatus } from '../server/ghl/readonly';
import { MemoryReviewStore } from '../server/store/memory';

const TOKEN = 'token-should-not-leak-9f3a';
const SECRET = 'session-secret-test-value';

function envOf(values: Record<string, string | undefined>): Env {
  return { get: (name) => values[name] };
}

function harness(extra: Record<string, string | undefined> = {}, fetchImpl?: typeof fetch) {
  const production = new MemoryReviewStore('production');
  const demo = new MemoryReviewStore('demo');
  const deps: ApiDeps = {
    env: envOf({
      SPARKED_OPERATOR_TOKEN: TOKEN,
      SPARKED_SESSION_SECRET: SECRET,
      SPARKED_COOKIE_SECURE: 'false',
      ...extra,
    }),
    now: () => new Date('2026-11-07T15:00:00-05:00'),
    fetchImpl,
    stores: {
      demo: () => ({ ok: true, store: demo, durable: false, realm: 'demo' }),
      production: async () => ({ ok: true, store: production, durable: false, realm: 'production' }),
    },
  };
  return { production, demo, deps };
}

function call(deps: ApiDeps, path: string, init: RequestInit = {}) {
  return handleApi(new Request(`https://dashboard.example${path}`, init), deps);
}

function authed(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${TOKEN}`);
  return { ...init, headers };
}

describe('autorización', () => {
  it('no entrega datos de clientes sin sesión', async () => {
    const { production, deps } = harness();
    await production.saveReview({
      id: 'rv_secret', prospectId: 'pr_secret', decision: 'discard', reason: 'Negocio secreto',
      revisitOn: null, decidedBy: 'adri', decidedAt: '2026-11-07T15:00:00-05:00',
    });
    const response = await call(deps, '/api/state');
    const text = await response.text();
    expect(response.status).toBe(401);
    expect(text).not.toContain('Negocio secreto');
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain(SECRET);
  });

  it('un token incorrecto no abre sesión', async () => {
    const { deps } = harness();
    const response = await call(deps, '/api/session', { method: 'POST', body: JSON.stringify({ token: 'no' }) });
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain(TOKEN);
  });

  it('la cookie permite leer y una mutación sin encabezado no escribe', async () => {
    const { production, deps } = harness();
    const login = await call(deps, '/api/session', { method: 'POST', body: JSON.stringify({ token: TOKEN }) });
    expect(login.status).toBe(200);
    const cookie = login.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).not.toContain(TOKEN);
    const read = await call(deps, '/api/state', { headers: { cookie: cookie.split(';')[0] } });
    expect(read.status).toBe(200);
    const write = await call(deps, '/api/reviews', {
      method: 'POST',
      headers: { cookie: cookie.split(';')[0], 'content-type': 'application/json' },
      body: JSON.stringify({ prospectId: 'pr_a', decision: 'approve_contact' }),
    });
    expect(write.status).toBe(403);
    expect((await production.load()).reviews).toHaveLength(0);
  });

  it('con acceso y sin base no devuelve filas', async () => {
    const deps = createDefaultDeps(envOf({ SPARKED_OPERATOR_TOKEN: TOKEN, SPARKED_SESSION_SECRET: SECRET }));
    const response = await handleApi(new Request('https://dashboard.example/api/state', {
      headers: { authorization: `Bearer ${TOKEN}` },
    }), deps);
    const text = await response.text();
    expect(response.status).toBe(503);
    expect(text).toContain('persistence_not_configured');
    expect(text).not.toContain('prospect');
    expect(text).not.toContain(TOKEN);
  });

  it('sin variables de acceso el servidor dice que no está configurado', async () => {
    const deps = createDefaultDeps(envOf({}));
    const response = await handleApi(new Request('https://dashboard.example/api/health'), deps);
    const body = await response.json() as { auth: string; persistence: string; liveReads: boolean; sends: string };
    expect(body.auth).toBe('not_configured');
    expect(body.persistence).toBe('persistence_not_configured');
    expect(body.liveReads).toBe(false);
    expect(body.sends).toBe('disabled');
  });
});

describe('persistencia y compuertas', () => {
  it('guarda una revisión y mantiene la demo aparte', async () => {
    const { production, demo, deps } = harness({ SPARKED_ALLOW_DEMO_API: 'true' });
    const saved = await call(deps, '/api/reviews', authed({
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'rv_1', prospectId: 'pr_1', decision: 'discard', reason: 'Cadena' }),
    }));
    expect(saved.status).toBe(200);
    expect((await production.load()).reviews).toHaveLength(1);
    const denied = await call(deps, '/api/state', authed({ headers: { 'x-sparked-realm': 'demo' } }));
    expect(denied.status).toBe(200);
    const body = await denied.json() as { realm: string; state: { reviews: unknown[] } };
    expect(body.realm).toBe('demo');
    expect(body.state.reviews).toHaveLength(0);
    expect((await demo.load()).reviews).toHaveLength(0);
  });

  it('la demo no se abre si no está habilitada y no muestra producción', async () => {
    const { production, deps } = harness();
    await production.saveReview({
      id: 'rv_2', prospectId: 'pr_2', decision: 'approve_contact', reason: null, revisitOn: null,
      decidedBy: 'adri', decidedAt: '2026-11-07T15:00:00-05:00',
    });
    const response = await call(deps, '/api/state', authed({ headers: { 'x-sparked-realm': 'demo' } }));
    const text = await response.text();
    expect(response.status).toBe(403);
    expect(text).not.toContain('pr_2');
  });

  it('aprobar un borrador no lo marca enviado y el envío está apagado', async () => {
    const { production, deps } = harness();
    const approved = await call(deps, '/api/drafts/dr_1/approve', authed({ method: 'POST' }));
    const body = await approved.json() as { status: string; sentAt: string | null; send: string };
    expect(body.status).toBe('approved');
    expect(body.sentAt).toBeNull();
    expect(body.send).toBe('disabled');
    const sent = await call(deps, '/api/drafts/dr_1/send', authed({ method: 'POST' }));
    expect(sent.status).toBe(403);
    expect((await production.load()).draftApprovals.dr_1).toBeTruthy();
  });

  it('mover etapa queda en el dashboard y no llama a GHL', async () => {
    let called = false;
    const { production, deps } = harness({}, () => { called = true; return Promise.reject(new Error('network')); });
    const response = await call(deps, '/api/stages', authed({
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ opportunityId: 'op_1', stage: 'qualified' }),
    }));
    const body = await response.json() as { ghl: string; writeGate: string };
    expect(response.status).toBe(200);
    expect(body.ghl).toBe('not_synced');
    expect(body.writeGate).toBe('disabled');
    expect(called).toBe(false);
    expect((await production.load()).stages[0].stage).toBe('qualified');
  });

  it('rechaza caja inventada y guarda un monto real', async () => {
    const { deps } = harness();
    const invented = await call(deps, '/api/payments', authed({
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ opportunityId: 'op_1', type: 'project_50pct', contractSigned: true, amountContracted: 2850, depositVerified: true }),
    }));
    expect(invented.status).toBe(400);
    const recorded = await call(deps, '/api/payments', authed({
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        opportunityId: 'op_1', type: 'project_50pct', contractSigned: true, offer: 'core', amountContracted: 2850,
        depositVerified: true, depositReceived: 1500, verifiedAt: '2026-12-02T15:00:00-05:00',
      }),
    }));
    expect(recorded.status).toBe(200);
    const income = await call(deps, '/api/income', authed());
    const totals = await income.json() as { verifiedSales: number; totals: { paidCash: number } };
    expect(totals.verifiedSales).toBe(1);
    expect(totals.totals.paidCash).toBe(1500);
  });

  it('programa seguimientos desde el envío y la baja no envía', async () => {
    const { production, deps } = harness();
    const plan = await call(deps, '/api/followups/schedule', authed({
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ firstSentAt: '2026-11-08T03:30:00Z' }),
    }));
    const body = await plan.json() as { plan: { day: number; dueOn: string }[]; send: string };
    expect(body.plan[0]).toEqual({ day: 4, dueOn: '2026-11-11' });
    expect(body.send).toBe('disabled');
    const stop = await call(deps, '/api/followups/stop', authed({
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prospectId: 'pr_1', reason: 'opt_out' }),
    }));
    expect(stop.status).toBe(200);
    expect((await production.load()).followupStops[0].reason).toBe('opt_out');
  });

  it('valida evidencia y prepara correo sin enviarlo', async () => {
    const { deps } = harness();
    const bad = await call(deps, '/api/evidence', authed({
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'ev_1', prospectId: 'pr_1', component: 'social_outdated',
        fact: 'La cuenta cayó en el último año.', url: 'https://social.ejemplo.invalid/a', observedAt: '2026-11-01T15:00:00-05:00',
      }),
    }));
    expect(bad.status).toBe(400);
    const mail = await call(deps, '/api/mail/prepare', authed({
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'email', subject: 'Hola', text: 'Mira sparkedreactions.com' }),
    }));
    const prepared = await mail.json() as { send: string };
    expect(prepared.send).toBe('disabled');
    const send = await call(deps, '/api/mail/send', authed({ method: 'POST' }));
    expect(send.status).toBe(403);
  });
});

describe('adaptador GHL de solo lectura', () => {
  it('no llama a la red ni usa el id candidato si falta configuración', async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response('{}');
    };
    const result = await ghlStatus({ env: envOf({ GHL_API_TOKEN: TOKEN, GHL_LOCATION_ID: 'loc' }), fetchImpl });
    expect(result.status).toBe('not_configured');
    expect(calls).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain(UNVERIFIED_PIPELINE_CANDIDATE.id);
  });

  it('pagina, mapea etapas y no trata Closed ni status won como ganado', async () => {
    const pages = [
      {
        pipelines: [{
          id: 'pipe_live', name: 'Marketing Pipeline',
          stages: [
            { id: 'st_new', name: 'New Lead' },
            { id: 'st_closed', name: 'Closed' },
            { id: 'st_won', name: 'Closed Won' },
          ],
        }],
      },
      { opportunities: [{ id: 'o1', pipelineId: 'pipe_live', pipelineStageId: 'st_closed', status: 'won', monetaryValue: 2850, updatedAt: '2026-11-01T15:00:00Z' }], meta: { startAfter: '1', startAfterId: 'o1' } },
      { opportunities: [{ id: 'o2', pipelineId: 'pipe_live', pipelineStageId: 'st_won', status: 'open', monetaryValue: 10 }], meta: {} },
    ];
    let i = 0;
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      seen.push(`${init?.method ?? 'GET'} ${String(input)}`);
      const body = pages[Math.min(i, pages.length - 1)];
      i += 1;
      return new Response(JSON.stringify(body), { status: 200 });
    };
    const env = envOf({ GHL_API_TOKEN: TOKEN, GHL_LOCATION_ID: 'loc', GHL_PIPELINE_ID: 'pipe_live' });
    const result = await ghlOpportunities({ env, fetchImpl });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.map((row) => row.id)).toEqual(['o1', 'o2']);
    expect(result.data[0].stage).toBe('closed');
    expect(result.data[0].outcome).toBe('unverified');
    expect(result.data[0].ghlStatus).toBe('won');
    expect(result.data[0].statedValueUse).toBe('ignored_until_verified');
    expect(result.data[1].stage).toBeNull();
    expect(seen.every((line) => line.startsWith('GET '))).toBe(true);
    expect(seen.some((line) => line.includes('pipe_live'))).toBe(true);
    expect(seen.some((line) => line.includes(UNVERIFIED_PIPELINE_CANDIDATE.id))).toBe(false);
  });

  it('un error en la segunda página no devuelve un resultado parcial como si estuviera completo', async () => {
    let n = 0;
    const fetchImpl: typeof fetch = async () => {
      n += 1;
      if (n === 1) {
        return new Response(JSON.stringify({ pipelines: [{ id: 'pipe_live', name: 'Marketing', stages: [{ id: 'st', name: 'New Lead' }] }] }), { status: 200 });
      }
      if (n === 2) {
        return new Response(JSON.stringify({ opportunities: [{ id: 'o1', pipelineStageId: 'st' }], meta: { startAfterId: 'o1', startAfter: '1' } }), { status: 200 });
      }
      return new Response('no', { status: 500 });
    };
    const result = await ghlOpportunities({
      env: envOf({ GHL_API_TOKEN: TOKEN, GHL_LOCATION_ID: 'loc', GHL_PIPELINE_ID: 'pipe_live' }),
      fetchImpl,
    });
    expect(result.status).toBe('error');
  });

  it('si el id configurado no está en GHL, no finge que el pipeline está verificado', async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ pipelines: [{ id: 'otra', name: 'Otra', stages: [] }] }), { status: 200 });
    const result = await ghlStatus({
      env: envOf({ GHL_API_TOKEN: TOKEN, GHL_LOCATION_ID: 'loc', GHL_PIPELINE_ID: UNVERIFIED_PIPELINE_CANDIDATE.id }),
      fetchImpl,
    });
    expect(result.status).toBe('pipeline_not_verified');
  });
});
