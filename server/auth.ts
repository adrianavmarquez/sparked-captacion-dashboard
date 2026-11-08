import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Actor } from '../src/data/model';
import type { Env } from './env';
import { readEnv } from './env';

const COOKIE = 'sparked_session';
const MAX_AGE_SEC = 60 * 60 * 12;

export interface Session {
  actor: Actor;
  exp: number;
}

export interface AuthConfig {
  configured: boolean;
  token?: string;
  secret?: string;
  actor: Actor;
  secureCookie: boolean;
}

export function authConfig(env: Env): AuthConfig {
  const token = readEnv(env, 'SPARKED_OPERATOR_TOKEN');
  const secret = readEnv(env, 'SPARKED_SESSION_SECRET');
  const actorRaw = readEnv(env, 'SPARKED_OPERATOR_ACTOR') ?? 'adri';
  const actor: Actor = actorRaw === 'chiri' || actorRaw === 'maria' ? actorRaw : 'adri';
  const secure = readEnv(env, 'SPARKED_COOKIE_SECURE') !== 'false';
  const configured = Boolean(token && secret && secret.length >= 16);
  return { configured, token, secret, actor, secureCookie: secure };
}

export function tokensMatch(left: string, right: string): boolean {
  const key = 'sparked-operator-compare';
  const a = createHmac('sha256', key).update(left).digest();
  const b = createHmac('sha256', key).update(right).digest();
  return timingSafeEqual(a, b);
}

export function signSession(session: Session, secret: string): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function readSession(cookieHeader: string | null, secret: string, nowMs: number): Session | null {
  const raw = readCookie(cookieHeader, COOKIE);
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Session;
    if (!data || (data.actor !== 'adri' && data.actor !== 'chiri' && data.actor !== 'maria')) return null;
    if (typeof data.exp !== 'number' || data.exp < nowMs) return null;
    return data;
  } catch {
    return null;
  }
}

export function sessionCookie(value: string, secure: boolean): string {
  const parts = [`${COOKIE}=${value}`, 'HttpOnly', 'Path=/', 'SameSite=Strict', `Max-Age=${MAX_AGE_SEC}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearCookie(secure: boolean): string {
  const parts = [`${COOKIE}=`, 'HttpOnly', 'Path=/', 'SameSite=Strict', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}
