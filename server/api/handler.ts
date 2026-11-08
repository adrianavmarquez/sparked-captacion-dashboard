import { GOAL } from '../../src/domain/constants';
import { scheduleFollowups } from '../../src/domain/followups';
import { incomeLine, incomeTotals, isVerifiedWebsiteSale } from '../../src/domain/income';
import { qualificationOf } from '../../src/domain/qualification';
import type { Offer } from '../../src/data/model';
import { authConfig, clearCookie, readSession, sessionCookie, signSession, tokensMatch, type Session } from '../auth';
import type { Env } from '../env';
import { readEnv } from '../env';
import { assertGhlWriteDisabled, IntegrationDisabledError } from '../ghl/gates';
import { ghlOpportunities, ghlStatus, type GhlDeps } from '../ghl/readonly';
import { prepareMail, sendMail } from '../mail/port';
import { redact } from '../redact';
import type { StoreResult } from '../store/types';
import {
  InputError, parseEvidenceBody, parseFit, parsePayment, parseReview, parseSchedule, parseStage, parseStop,
} from '../validate';

export interface ApiDeps {
  env: Env;
  now: () => Date;
  stores: {
    demo: () => StoreResult;
    production: () => Promise<StoreResult>;
  };
  fetchImpl?: typeof fetch;
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};

export async function handleApi(req: Request, deps: ApiDeps): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  try {
    if (!originAllowed(req, url)) return json(403, { error: 'origin' });
    if (req.method === 'GET' && path === '/api/health') return health(deps);
    if (path === '/api/session') return sessionRoute(req, deps);
    const session = await requireSession(req, deps);
    if (session instanceof Response) return session;
    if (mutationNeedsHeader(req) && req.headers.get('x-sparked-request') !== '1') {
      return json(403, { error: 'missing_request_header' });
    }
    const opened = await openStore(req, deps);
    if (opened instanceof Response) return opened;
    return await route(req, path, deps, session, opened);
  } catch (error) {
    if (error instanceof InputError) return json(400, { error: 'validation', issues: error.issues });
    if (error instanceof IntegrationDisabledError) return json(403, { error: error.gate, send: 'disabled', ghl: 'not_synced' });
    if (error instanceof Response) return error;
    return json(500, { error: 'internal', detail: redact(error instanceof Error ? error.name : 'error') });
  }
}

async function route(req: Request, path: string, deps: ApiDeps, session: Session, opened: Extract<StoreResult, { ok: true }>): Promise<Response> {
  const store = opened.store;
  if (req.method === 'GET' && path === '/api/state') {
    const state = await store.load();
    return json(200, { realm: opened.realm, durable: opened.durable, live: false, state });
  }
  if (req.method === 'POST' && path === '/api/reviews') {
    if (session.actor !== 'adri') return json(403, { error: 'actor' });
    const review = parseReview(await readBody(req), 'adri', deps.now().toISOString());
    await store.saveReview(review);
    return json(200, { review, ghl: 'not_synced' });
  }
  if (req.method === 'POST' && path === '/api/fits') {
    if (session.actor !== 'adri') return json(403, { error: 'actor' });
    const fit = parseFit(await readBody(req), 'adri', deps.now().toISOString());
    await store.saveFit(fit);
    return json(200, { fit, qualifiedByStageName: false, qualification: qualificationOf({ fit: fit.fit, interestConfirmed: null }) });
  }
  const approve = path.match(/^\/api\/drafts\/([A-Za-z0-9_-]{1,80})\/approve$/);
  if (req.method === 'POST' && approve) {
    const approvedAt = deps.now().toISOString();
    await store.saveDraftApproval(approve[1], approvedAt);
    return json(200, { draftId: approve[1], status: 'approved', approvedAt, sentAt: null, send: 'disabled' });
  }
  const send = path.match(/^\/api\/drafts\/([A-Za-z0-9_-]{1,80})\/send$/);
  if (req.method === 'POST' && send) {
    sendMail();
  }
  if (req.method === 'POST' && path === '/api/payments') {
    const payment = parsePayment(await readBody(req));
    await store.savePayment(payment);
    const line = incomeLine({ offer: payment.offer ?? null, payment });
    return json(200, { payment, line });
  }
  if (req.method === 'POST' && path === '/api/stages') {
    const move = parseStage(await readBody(req), 'adri', deps.now().toISOString());
    let writeBlocked = false;
    try {
      assertGhlWriteDisabled();
    } catch (error) {
      if (!(error instanceof IntegrationDisabledError)) throw error;
      writeBlocked = true;
    }
    if (!writeBlocked) return json(500, { error: 'write_gate_open' });
    await store.saveStage(move);
    return json(200, { stage: move, ghl: 'not_synced', writeGate: 'disabled' });
  }
  if (req.method === 'POST' && path === '/api/evidence') {
    const evidence = parseEvidenceBody(await readBody(req));
    await store.saveEvidence(evidence);
    return json(200, { evidence });
  }
  if (req.method === 'POST' && path === '/api/followups/stop') {
    const stop = parseStop(await readBody(req));
    await store.stopFollowups({ ...stop, stoppedAt: deps.now().toISOString() });
    return json(200, { ...stop, stopped: true, send: 'disabled' });
  }
  if (req.method === 'POST' && path === '/api/followups/schedule') {
    const body = parseSchedule(await readBody(req));
    const plan = scheduleFollowups(body.firstSentAt);
    return json(200, { plan, send: 'disabled' });
  }
  if (req.method === 'GET' && path === '/api/income') {
    const state = await store.load();
    const lines = state.payments.map((payment) => incomeLine({
      offer: (payment as { offer?: Offer | null }).offer ?? null,
      payment,
      window: { start: GOAL.windowStart, end: GOAL.windowEnd },
    }));
    const verifiedSales = state.payments.filter((payment) => isVerifiedWebsiteSale({
      offer: (payment as { offer?: Offer | null }).offer ?? null,
      payment,
      window: { start: GOAL.windowStart, end: GOAL.windowEnd },
    })).length;
    return json(200, { lines, totals: incomeTotals(lines), verifiedSales, target: GOAL.target, outcome: 'unverified' });
  }
  if (req.method === 'GET' && path === '/api/ghl/status') return json(200, await ghlStatus(ghlDeps(deps)));
  if (req.method === 'GET' && path === '/api/ghl/opportunities') return json(200, await ghlOpportunities(ghlDeps(deps)));
  if (req.method === 'POST' && path === '/api/mail/prepare') {
    const body = await readBody(req) as { channel?: string; subject?: string; text?: string };
    if ((body.channel !== 'email' && body.channel !== 'linkedin') || typeof body.subject !== 'string' || typeof body.text !== 'string') {
      throw new InputError(['mail']);
    }
    return json(200, prepareMail({ channel: body.channel, subject: body.subject, text: body.text }));
  }
  if (req.method === 'POST' && path === '/api/mail/send') sendMail();
  return json(404, { error: 'not_found' });
}

function ghlDeps(deps: ApiDeps): GhlDeps {
  return { env: deps.env, fetchImpl: deps.fetchImpl };
}

async function health(deps: ApiDeps): Promise<Response> {
  const auth = authConfig(deps.env);
  const production = await deps.stores.production();
  return json(200, {
    ok: true,
    auth: auth.configured ? 'configured' : 'not_configured',
    persistence: production.ok ? (production.durable ? 'durable' : 'ephemeral') : production.error,
    ghl: readEnv(deps.env, 'GHL_API_TOKEN') ? 'configured' : 'not_configured',
    liveReads: false,
    sends: 'disabled',
    ghlWrites: 'disabled',
  });
}

async function sessionRoute(req: Request, deps: ApiDeps): Promise<Response> {
  const auth = authConfig(deps.env);
  if (!auth.configured || !auth.token || !auth.secret) return json(503, { error: 'auth_not_configured', live: false });
  if (req.method === 'GET') {
    const session = readSession(req.headers.get('cookie'), auth.secret, deps.now().getTime());
    if (!session) return json(401, { error: 'unauthorized' });
    return json(200, { authenticated: true, actor: session.actor });
  }
  if (req.method === 'DELETE') {
    return json(200, { authenticated: false }, { 'set-cookie': clearCookie(auth.secureCookie) });
  }
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const body = await readBody(req) as { token?: unknown };
  const token = typeof body.token === 'string' ? body.token : '';
  if (!tokensMatch(token, auth.token)) return json(401, { error: 'unauthorized' });
  const session: Session = { actor: auth.actor === 'chiri' ? 'chiri' : 'adri', exp: deps.now().getTime() + 12 * 60 * 60 * 1000 };
  const cookie = sessionCookie(signSession(session, auth.secret), auth.secureCookie);
  return json(200, { authenticated: true, actor: session.actor }, { 'set-cookie': cookie });
}

async function requireSession(req: Request, deps: ApiDeps): Promise<Session | Response> {
  const auth = authConfig(deps.env);
  if (!auth.configured || !auth.secret || !auth.token) return json(503, { error: 'auth_not_configured', live: false });
  const header = req.headers.get('authorization');
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    if (!tokensMatch(token, auth.token)) return json(401, { error: 'unauthorized' });
    return { actor: auth.actor === 'chiri' ? 'chiri' : 'adri', exp: deps.now().getTime() + 1000 };
  }
  const session = readSession(req.headers.get('cookie'), auth.secret, deps.now().getTime());
  if (!session) return json(401, { error: 'unauthorized' });
  return session;
}

async function openStore(req: Request, deps: ApiDeps): Promise<Extract<StoreResult, { ok: true }> | Response> {
  const demo = req.headers.get('x-sparked-realm') === 'demo';
  if (demo) {
    if (readEnv(deps.env, 'SPARKED_ALLOW_DEMO_API') !== 'true') return json(403, { error: 'demo_api_disabled' });
    const handle = deps.stores.demo();
    if (handle.ok && handle.realm !== 'demo') return json(500, { error: 'demo_isolation' });
    return handle.ok ? handle : json(503, { error: handle.error, live: false });
  }
  const handle = await deps.stores.production();
  if (!handle.ok) return json(503, { error: handle.error, live: false, durable: false });
  if (handle.realm !== 'production') return json(500, { error: 'demo_isolation' });
  return handle;
}

function mutationNeedsHeader(req: Request): boolean {
  if (req.method === 'GET' || req.method === 'HEAD') return false;
  const header = req.headers.get('authorization');
  if (header?.startsWith('Bearer ')) return false;
  return true;
}

function originAllowed(req: Request, url: URL): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  return origin === url.origin;
}

async function readBody(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > 65_536) throw new InputError(['body_too_large']);
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new InputError(['json']);
  }
}

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } });
}
