import { ADRIANA_SIGNATURE, BASE_TEMPLATE } from './template-source';

export type EmailLevel = 'cotidiano' | 'estructurado' | 'propuesta';
export type EmailLang = 'en' | 'es';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  level: EmailLevel;
  lang: EmailLang;
}

export interface RenderInput {
  subject: string;
  body: string;
  firstName?: string | null;
  lang?: EmailLang;
  level?: EmailLevel;
  section?: { heading: string; text: string } | null;
  summary?: string | null;
  nextStep?: { title: string; detail: string } | null;
}

const WRAPPER = "font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#000000;max-width:640px;width:100%;text-align:left";
const HEADING = 'margin:24px 0 10px;color:#523129;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase';
const PARAGRAPH = 'margin:0 0 16px';
const GREETING = /^(hi|hello|hola|buenos días|buenos dias)\b/i;
const SIGN_OFF = /^(best|saludos|un saludo|gracias),?$/i;

export function languageFor(locality: string, body: string): EmailLang {
  if (/[áéíóúñ¿¡]/i.test(body) || /\b(hola|gracias|escribo|te mando)\b/i.test(body)) return 'es';
  if (/charlotte/i.test(locality)) return 'en';
  return 'es';
}

export function renderSparkedEmail(input: RenderInput): RenderedEmail {
  const lang = input.lang ?? 'en';
  const level = input.level ?? 'cotidiano';
  const subject = input.subject.trim().slice(0, 200);
  const parts = splitCopy(input.body);
  const greeting = parts.greeting ?? defaultGreeting(lang, input.firstName);
  const signOff = lang === 'es' ? 'Saludos,' : 'Best,';
  const blocks: string[] = [paragraph(greeting), ...parts.paragraphs.map(paragraph)];

  if (level !== 'cotidiano' && input.section?.heading && input.section.text) {
    blocks.push(`<p style="${HEADING}">${escapeHtml(input.section.heading)}</p>`);
    blocks.push(`<div style="border-left:3px solid #523129;padding-left:16px;margin:0 0 20px"><p style="margin:0">${inline(input.section.text)}</p></div>`);
  }
  if (level === 'propuesta' && input.summary?.trim()) {
    blocks.push(card('#F5EDE3', inline(input.summary)));
  }
  if (level === 'propuesta' && input.nextStep?.title && input.nextStep.detail) {
    blocks.push(card('#D9EBFA', `<strong>${escapeHtml(input.nextStep.title)}</strong><br>${inline(input.nextStep.detail)}`));
  } else if (level === 'estructurado' && input.nextStep?.title && input.nextStep.detail) {
    blocks.push(card('#D9EBFA', `<strong>${escapeHtml(input.nextStep.title)}</strong><br>${inline(input.nextStep.detail)}`));
  }

  blocks.push(`<p style="${PARAGRAPH}">${escapeHtml(signOff)}</p>`);
  blocks.push(ADRIANA_SIGNATURE);
  const html = shell(lang, blocks.join(''));
  const text = [
    greeting,
    '',
    ...parts.paragraphs,
    '',
    ...(level !== 'cotidiano' && input.section ? [input.section.heading.toUpperCase(), input.section.text, ''] : []),
    ...(level === 'propuesta' && input.summary ? [input.summary, ''] : []),
    ...(input.nextStep && level !== 'cotidiano' ? [`${input.nextStep.title}: ${input.nextStep.detail}`, ''] : []),
    signOff,
    '',
    textSignature(),
  ].join('\n');
  return { subject, html, text, level, lang };
}

export function defaultOutreach(company: string, locality: string): { subject: string; body: string; lang: EmailLang } {
  const lang = languageFor(locality, '');
  if (lang === 'en') {
    return {
      lang,
      subject: `${company}: a note on the website`,
      body: [
        `I am writing because I looked at ${company} in ${locality}.`,
        'What I can see from the outside is the public site. I am not attaching numbers or a promise.',
        'If you want, I can send a short read of that. The work lives at https://sparkedreactions.com',
      ].join('\n\n'),
    };
  }
  return {
    lang,
    subject: `${company}: una nota sobre la web`,
    body: [
      `Escribo porque miré ${company} en ${locality}.`,
      'Lo que puedo ver desde afuera es el sitio público. No adjunto cifras ni una promesa.',
      'Si te sirve, te mando una lectura corta. El trabajo está en https://sparkedreactions.com',
    ].join('\n\n'),
  };
}

export function defaultFollowup(company: string, day: number, lang: EmailLang): { subject: string; body: string } {
  if (lang === 'en') {
    return {
      subject: `Following up about ${company}`,
      body: [
        `I wrote a few days ago about ${company} and wanted to leave the note in one place.`,
        'There is no deadline on it. If a short read of the public site is useful, I can send it.',
      ].join('\n\n'),
    };
  }
  return {
    subject: `Seguimiento sobre ${company}, día ${day}`,
    body: [
      `Escribí hace unos días sobre ${company} y quería dejar la nota en un solo lugar.`,
      'No hay una fecha límite. Si te sirve una lectura corta del sitio público, te la mando.',
    ].join('\n\n'),
  };
}

function shell(lang: EmailLang, inner: string): string {
  const head = BASE_TEMPLATE.slice(0, BASE_TEMPLATE.indexOf('<body'));
  return `${head.replace('lang="en"', `lang="${lang}"`)}<body style="margin:0;padding:20px;background:#ffffff"><div style="${WRAPPER}">${inner}</div></body></html>`;
}

function splitCopy(body: string): { greeting: string | null; paragraphs: string[] } {
  const chunks = body.split(/\n\s*\n/).map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!chunks.length) return { greeting: null, paragraphs: [] };
  let greeting: string | null = null;
  if (GREETING.test(chunks[0])) greeting = chunks.shift() ?? null;
  while (chunks.length && SIGN_OFF.test(chunks[chunks.length - 1])) chunks.pop();
  return { greeting, paragraphs: chunks };
}

function defaultGreeting(lang: EmailLang, firstName?: string | null): string {
  const name = firstName?.trim();
  if (lang === 'es') return name ? `Hola ${name},` : 'Hola,';
  return name ? `Hi ${name},` : 'Hi,';
}

function paragraph(text: string): string {
  return `<p style="${PARAGRAPH}">${inline(text)}</p>`;
}

function card(background: string, inner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background-color:${background};border-radius:6px"><tr><td style="padding:18px 20px;font-family:'Fira Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#000000">${inner}</td></tr></table>`;
}

function inline(text: string): string {
  return linkify(escapeHtml(text));
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function linkify(escaped: string): string {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#523129;text-decoration:underline">${url}</a>`);
}

function textSignature(): string {
  return [
    'Adriana V. Márquez',
    'Co-founder · Market Research Analyst & Creative Strategist',
    'SPARKED REACTIONS',
    'https://sparkedreactions.com/',
    '+1 (305) 469-5202',
  ].join('\n');
}
