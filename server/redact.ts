/** Quita secretos antes de cualquier texto que pueda salir en una respuesta o un log. */
export function redact(text: string): string {
  return text
    .replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgres://[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{6,}/gi, 'Bearer [redacted]')
    .replace(/\b(pit|eyJ)[A-Za-z0-9._~+/=-]{8,}\b/g, '[redacted]')
    .replace(/([?&](?:token|key|secret|password|api_key)=)[^&\s]+/gi, '$1[redacted]');
}

export function publicError(code: string, status: number): { status: number; body: { error: string } } {
  return { status, body: { error: code } };
}
