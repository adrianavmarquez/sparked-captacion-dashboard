import type { Env } from '../env';
import { readEnv } from '../env';
import { redact } from '../redact';

export interface OutboundMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: OutboundMail): Promise<{ messageId: string }>;
  verify(): Promise<void>;
}

/** SMTP de Gmail por el puerto 465. La clave no se escribe en errores. */
export function smtpMailer(env: Env): Mailer | null {
  const user = readEnv(env, 'GMAIL_SENDER');
  const pass = readEnv(env, 'GMAIL_APP_PASSWORD');
  if (!user || !pass) return null;
  const name = readEnv(env, 'GMAIL_SENDER_NAME');
  const from = name ? `${name} <${user}>` : user;
  return {
    async send(message) {
      const nodemailer = await import('nodemailer');
      const transport = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
      });
      try {
        const info = await transport.sendMail({
          from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        const messageId = typeof info.messageId === 'string' && info.messageId ? info.messageId : '';
        if (!messageId) throw new Error('Gmail no devolvió un Message-ID.');
        return { messageId };
      } catch (error) {
        throw new Error(scrubSmtp(error, pass));
      }
    },
    async verify() {
      const nodemailer = await import('nodemailer');
      const transport = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
      });
      try {
        await transport.verify();
      } catch (error) {
        throw new Error(scrubSmtp(error, pass));
      }
    },
  };
}

export function scrubSmtp(error: unknown, secret: string): string {
  const raw = error instanceof Error ? error.message : 'smtp';
  return redact(raw.split(secret).join('[redacted]'));
}
