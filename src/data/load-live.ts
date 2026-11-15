import { AdapterError } from './adapter';
import { datasetFromWorkspace, type LiveGhlOpp, type WorkspacePayload } from './live-dataset';
import type { Dataset } from './model';

/** La cookie no llegó. No es un rechazo de rol: hay que volver al candado. */
export class SessionRequiredError extends Error {
  constructor() { super('session_required'); }
}

export async function loadLiveDataset(): Promise<{ dataset: Dataset; ghlOk: boolean }> {
  let response: Response;
  try {
    response = await fetch('/api/workspace', { credentials: 'same-origin' });
  } catch {
    throw new AdapterError('network', 'No se pudo leer la fuente de datos.');
  }
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new AdapterError('network', 'No se pudo leer la fuente de datos.');
  if (response.status === 401) throw new SessionRequiredError();
  if (!response.ok) throw new AdapterError('network', 'No se pudo leer la fuente de datos.');
  const body = await response.json() as WorkspacePayload;
  return { dataset: datasetFromWorkspace(body), ghlOk: body.ghlOk === true };
}

export type { LiveGhlOpp };
