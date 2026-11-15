import type { Draft, FitAssessment, PaymentVerification, Review, Stage } from './model';
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
  lastDraft: Draft | null = null;

  async load(): Promise<SavedState> {
    const body = await request<{ state: SavedState }>('/api/state');
    return body.state;
  }
  async saveReview(review: Review) {
    const body = await request<{ draft?: Draft | null }>('/api/reviews', review);
    this.lastDraft = body.draft ?? null;
  }
  async approveServerDraft(id: string, options?: { confirm?: boolean; subject?: string; body?: string }) {
    return request<Record<string, unknown>>(`/api/drafts/${encodeURIComponent(id)}/approve`, options ?? {});
  }
  async pushStage(input: { opportunityId: string; stage: Stage }) {
    return request<{ ghl: string; message?: string; opportunity?: { stage?: Stage | null; updatedAt?: string | null; outcome?: 'unverified' | 'lost'; ghlStatus?: string | null } }>('/api/stages', input);
  }
  async createOpportunity(input: { prospectId: string; name?: string; stage: Stage; status: string; monetaryValue: number | null }) {
    return request<Record<string, unknown>>('/api/ghl/opportunities', input);
  }
  async updateOpportunity(input: { id: string; name?: string; stage?: Stage; status?: string; monetaryValue: number | null }) {
    const { id, ...body } = input;
    return request<{ opportunity?: { stage?: Stage | null; ghlStatus?: string | null; outcome?: 'unverified' | 'lost'; updatedAt?: string | null } }>(`/api/ghl/opportunities/${encodeURIComponent(id)}`, body);
  }
  async optOut(email: string) {
    return request<{ email: string; domain: string | null }>('/api/opt-outs', { email });
  }
  async saveFit(fit: FitAssessment) { await request('/api/fits', fit); }
  async saveDraftApproval(draftId: string, approvedAt: string) { await request(`/api/drafts/${draftId}/approve`, { approvedAt }); }
  async savePayment(payment: PaymentVerification) { await request('/api/payments', payment); }
  async saveStage(move: StageMove) { await request('/api/stages', move); }
}

export type OperatorActor = 'adri' | 'chiri';

export async function probeBackendSession(): Promise<OperatorActor | null> {
  try {
    const response = await fetch('/api/session', { credentials: 'same-origin', signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('application/json')) return null;
    const body = await response.json() as { authenticated?: boolean; actor?: string };
    if (body.authenticated !== true) return null;
    return body.actor === 'chiri' ? 'chiri' : 'adri';
  } catch {
    return null;
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
    const payload = await response.json().catch(() => ({ error: 'error' })) as { error?: string; message?: string };
    throw new Error(payload.message || payload.error || 'No se pudo guardar en el servidor.');
  }
  return response.json() as Promise<T>;
}
