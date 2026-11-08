import type { FitAssessment, PaymentVerification, Review } from './model';
import type { Persistence, PersistenceKind, SavedState, StageMove } from './persistence';

const FLAG = 'sparked.backend.enabled';

export function shouldProbeBackend(storage: { getItem(key: string): string | null }): boolean {
  return storage.getItem(FLAG) === '1';
}

export function markBackendEnabled(storage: { setItem(key: string, value: string): void }) {
  storage.setItem(FLAG, '1');
}

export function clearBackendEnabled(storage: { removeItem(key: string): void }) {
  storage.removeItem(FLAG);
}

/**
 * Persistencia contra /api. La cookie de sesión viaja sola.
 * Este módulo no conoce tokens ni variables VITE_.
 */
export class BackendPersistence implements Persistence {
  kind: PersistenceKind = 'backend';
  label = 'Guardado en el servidor';
  short = 'Servidor';

  async load(): Promise<SavedState> {
    const body = await request<{ state: SavedState }>('/api/state');
    return body.state;
  }
  async saveReview(review: Review) { await request('/api/reviews', review); }
  async saveFit(fit: FitAssessment) { await request('/api/fits', fit); }
  async saveDraftApproval(draftId: string, approvedAt: string) { await request(`/api/drafts/${draftId}/approve`, { approvedAt }); }
  async savePayment(payment: PaymentVerification) { await request('/api/payments', payment); }
  async saveStage(move: StageMove) { await request('/api/stages', move); }
}

export async function probeBackendSession(): Promise<boolean> {
  try {
    const response = await fetch('/api/session', { credentials: 'same-origin', signal: AbortSignal.timeout(1500) });
    if (!response.ok) return false;
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('application/json')) return false;
    const body = await response.json() as { authenticated?: boolean };
    return body.authenticated === true;
  } catch {
    return false;
  }
}

export async function loginWithOperatorToken(token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch('/api/session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (response.status === 503) return { ok: false, error: 'El acceso del servidor todavía no está configurado.' };
    if (!response.ok) return { ok: false, error: 'No se pudo abrir la sesión.' };
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('application/json')) return { ok: false, error: 'El backend no está activado en este sitio.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'El backend no respondió.' };
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'content-type': 'application/json', 'x-sparked-request': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'error' })) as { error?: string };
    throw new Error(payload.error ?? 'No se pudo guardar en el servidor.');
  }
  return response.json() as Promise<T>;
}
