import type { Env } from '../env';
import { readEnv } from '../env';

const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const PUBLIC_MAILBOX = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'icloud.com', 'aol.com', 'proton.me', 'protonmail.com', 'me.com',
]);

export interface OptOutRow {
  email: string | null;
  domain: string | null;
}

export function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const email = value.trim().toLowerCase();
  return EMAIL.test(email) ? email : null;
}

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1);
}

export function isPublicMailbox(domain: string): boolean {
  return PUBLIC_MAILBOX.has(domain);
}

export function dailyCap(env: Env): number {
  const raw = readEnv(env, 'SPARKED_DAILY_SEND_CAP');
  if (!raw) return 20;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) return 20;
  return parsed;
}

export function optOutMatch(email: string, rows: OptOutRow[]): 'address' | 'domain' | null {
  const domain = emailDomain(email);
  for (const row of rows) {
    if (row.email && row.email === email) return 'address';
    if (row.domain && row.domain === domain) return 'domain';
  }
  return null;
}

/** Un correo de bandeja pública no bloquea el dominio entero. El del negocio sí. */
export function optOutTargets(email: string): { email: string; domain: string | null } {
  const domain = emailDomain(email);
  return { email, domain: isPublicMailbox(domain) ? null : domain };
}
