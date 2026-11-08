import { IntegrationDisabledError } from '../ghl/gates';

export interface MailPrepareInput {
  channel: 'email' | 'linkedin';
  subject: string;
  text: string;
}

export interface PreparedMail {
  prepared: true;
  send: 'disabled';
  channel: 'email' | 'linkedin';
  subject: string;
  text: string;
  warnings: string[];
}

const INVENTED_RESULT = /\b(\d+\s?%|aument(?:amos|ó|o)|casos de éxito|roi|ingresos de clientes)\b/i;

/**
 * Prepara un sobre en memoria. No abre Gmail, no crea borradores en el buzón
 * y no hace ninguna llamada de red.
 */
export function prepareMail(input: MailPrepareInput): PreparedMail {
  const warnings: string[] = ['send_disabled'];
  if (input.channel === 'email' && !/sparkedreactions\.com/i.test(input.text)) {
    warnings.push('missing_public_site_sample');
  }
  if (INVENTED_RESULT.test(input.text) || INVENTED_RESULT.test(input.subject)) {
    warnings.push('possible_invented_result');
  }
  return {
    prepared: true,
    send: 'disabled',
    channel: input.channel,
    subject: input.subject.slice(0, 200),
    text: input.text.slice(0, 8000),
    warnings,
  };
}

export function sendMail(): never {
  throw new IntegrationDisabledError(
    'mail_send',
    'El envío está deshabilitado hasta una aprobación aparte de Adri. No se crea un borrador en Gmail.',
  );
}
