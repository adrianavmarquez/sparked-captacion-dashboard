export class IntegrationDisabledError extends Error {
  readonly code = 'integration_disabled';
  constructor(readonly gate: 'ghl_write' | 'mail_send', message: string) {
    super(message);
    this.name = 'IntegrationDisabledError';
  }
}

/** Los writes a GHL están apagados en código. Una variable de entorno no los enciende. */
export function assertGhlWriteDisabled(): void {
  throw new IntegrationDisabledError(
    'ghl_write',
    'La escritura en GHL está deshabilitada. El cambio de etapa queda solo en el dashboard.',
  );
}

export function assertGhlMethodIsRead(method: string): void {
  if (method.toUpperCase() !== 'GET') assertGhlWriteDisabled();
}
