import type { Env } from '../env';
import { readEnv } from '../env';

export class IntegrationDisabledError extends Error {
  readonly code = 'integration_disabled';
  constructor(readonly gate: 'ghl_write' | 'mail_send', message: string) {
    super(message);
    this.name = 'IntegrationDisabledError';
  }
}

export class GhlScopeError extends Error {
  readonly code = 'missing_scope';
  constructor(readonly scope: string) {
    super(`El token de GHL no tiene el alcance ${scope}.`);
    this.name = 'GhlScopeError';
  }
}

export const PENDING_ACTIVATION = 'Pendiente de activar';

/** Solo el valor exacto `enabled` abre la compuerta. Cualquier otra cosa la deja cerrada. */
export function ghlWritesEnabled(env: Env): boolean {
  return readEnv(env, 'SPARKED_GHL_WRITES') === 'enabled';
}

export function sendsEnabled(env: Env): boolean {
  return readEnv(env, 'SPARKED_SENDS') === 'enabled';
}

export function assertGhlWritesEnabled(env: Env): void {
  if (!ghlWritesEnabled(env)) {
    throw new IntegrationDisabledError('ghl_write', `La escritura en GHL está ${PENDING_ACTIVATION.toLowerCase()}.`);
  }
}

export function assertSendsEnabled(env: Env): void {
  if (!sendsEnabled(env)) {
    throw new IntegrationDisabledError('mail_send', `El envío está ${PENDING_ACTIVATION.toLowerCase()}.`);
  }
}

/** Los GET de lectura siguen pasando. Un POST o PUT sin la bandera no sale. */
export function assertGhlMethodIsRead(method: string): void {
  if (method.toUpperCase() !== 'GET') {
    throw new IntegrationDisabledError(
      'ghl_write',
      'La escritura en GHL está deshabilitada. El cambio de etapa queda solo en el dashboard.',
    );
  }
}
