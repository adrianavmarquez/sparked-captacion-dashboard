import { FOLLOWUP_DAYS } from '../../src/domain/constants';
import { civilDateInEt } from '../../src/domain/time';
import type { Stage } from '../../src/data/model';
import type { Env } from '../env';
import { readEnv } from '../env';
import { ghlWritesEnabled, GhlScopeError, PENDING_ACTIVATION, sendsEnabled } from '../ghl/gates';
import { addGhlNote, createGhlOpportunity, updateGhlOpportunity, type GhlStatusName } from '../ghl/write';
import type { GhlDeps, GhlOpportunity } from '../ghl/readonly';
import { dailyCap, normalizeEmail, optOutMatch, optOutTargets } from '../mail/policy';
import { defaultFollowup, defaultOutreach, languageFor, renderSparkedEmail, type RenderedEmail } from '../email/render';
import type { Mailer } from '../mail/smtp';
import { smtpMailer } from '../mail/smtp';
import type { CatalogContact } from '../catalog/prepare';
import type { MailDraft, ReviewStore } from '../store/types';
import { isStage } from '../store/types';
import { InputError } from '../validate';

export class MailGateError extends Error {
  constructor(readonly status: number, readonly error: string, message: string) {
    super(message);
    this.name = 'MailGateError';
  }
}

const STATUSES: GhlStatusName[] = ['open', 'won', 'lost', 'abandoned'];

export function capabilityFlags(env: Env) {
  return {
    sends: sendsEnabled(env) ? 'enabled' as const : 'disabled' as const,
    ghlWrites: ghlWritesEnabled(env) ? 'enabled' as const : 'disabled' as const,
  };
}

export function previewMessage(input: { subject: string; body: string; locality?: string; firstName?: string | null }): RenderedEmail {
  const locality = input.locality ?? '';
  return renderSparkedEmail({
    subject: input.subject,
    body: input.body,
    firstName: input.firstName,
    lang: languageFor(locality, input.body),
    level: 'cotidiano',
  });
}

export async function ensureFirstDraft(store: ReviewStore, prospectId: string, company: string, locality: string): Promise<MailDraft> {
  const state = await store.load();
  const existing = state.mailDrafts.find((row) => row.prospectId === prospectId && row.kind === 'first_contact');
  if (existing) return existing;
  const copy = defaultOutreach(company, locality);
  const draft: MailDraft = {
    id: `dr_${prospectId}_first`,
    prospectId,
    kind: 'first_contact',
    followupDay: null,
    subject: copy.subject,
    body: copy.body,
    status: 'draft',
    recipient: null,
    messageId: null,
    approvedAt: null,
    sentAt: null,
  };
  await store.saveMailDraft(draft);
  return draft;
}

export async function approveDraft(args: {
  store: ReviewStore;
  env: Env;
  deps: GhlDeps;
  mailer?: Mailer;
  draftId: string;
  now: string;
  confirm: boolean;
  subject?: string;
  body?: string;
}): Promise<Record<string, unknown>> {
  const state = await args.store.load();
  const draft = state.mailDrafts.find((row) => row.id === args.draftId);
  if (!draft) {
    if (!sendsEnabled(args.env)) {
      await args.store.saveDraftApproval(args.draftId, args.now);
      return { draftId: args.draftId, status: 'approved', approvedAt: args.now, sentAt: null, send: 'disabled', message: PENDING_ACTIVATION };
    }
    throw new MailGateError(404, 'not_found', 'No está ese borrador.');
  }
  if (draft.status === 'sent' && draft.messageId && draft.sentAt) {
    return sentPayload(draft, true);
  }
  const subject = (args.subject ?? draft.subject).trim();
  const body = (args.body ?? draft.body).trim();
  if (!subject || !body) throw new InputError(['draft']);
  const catalog = await args.store.loadCatalog();
  const company = catalog.companies.find((row) => catalog.prospects.some((prospect) => prospect.id === draft.prospectId && prospect.companyId === row.id));
  const rendered = previewMessage({ subject, body, locality: company?.locality ?? '' });
  if (!sendsEnabled(args.env)) {
    await args.store.saveMailDraft({ ...draft, subject, body, status: 'approved', approvedAt: args.now });
    await args.store.saveDraftApproval(draft.id, args.now);
    return { draftId: draft.id, status: 'approved', approvedAt: args.now, sentAt: null, send: 'disabled', message: PENDING_ACTIVATION, subject, html: rendered.html, text: rendered.text };
  }
  const recipient = sourcedEmail(catalog.contacts, draft.prospectId);
  if (!args.confirm) {
    throw new MailGateError(409, 'confirmation_required', 'Confirma el envío.');
  }
  if (!recipient) throw new MailGateError(400, 'no_recipient', 'No hay un correo de un contacto con fuente.');
  const fresh = await args.store.load();
  const blocked = optOutMatch(recipient, fresh.optOuts);
  if (blocked) throw new MailGateError(409, 'opt_out', 'Esa dirección está en la lista de no contactar.');
  const cap = dailyCap(args.env);
  const sentToday = await args.store.countSendsOn(civilDateInEt(args.now));
  if (sentToday >= cap) throw new MailGateError(429, 'daily_cap', `Tope de ${cap} envíos hoy.`);
  await args.store.saveMailDraft({ ...draft, subject, body });
  const claim = `claim_${draft.id}_${args.now}`;
  const reserved = await args.store.reserveSend(draft.id, claim);
  if (reserved === 'sent') {
    const again = (await args.store.load()).mailDrafts.find((row) => row.id === draft.id);
    if (again?.status === 'sent') return sentPayload(again, true);
  }
  if (reserved === 'busy') throw new MailGateError(409, 'in_progress', 'Ese borrador ya se está enviando.');
  if (reserved === 'missing') throw new MailGateError(404, 'not_found', 'No está ese borrador.');
  const mailer = args.mailer ?? smtpMailer(args.env);
  if (!mailer) throw new MailGateError(503, 'mail_not_configured', 'Falta GMAIL_SENDER o GMAIL_APP_PASSWORD.');
  let messageId = '';
  try {
    const sent = await mailer.send({ to: recipient, subject: rendered.subject, text: rendered.text, html: rendered.html });
    messageId = sent.messageId;
  } catch (error) {
    await args.store.releaseSend(draft.id, claim);
    throw new MailGateError(502, 'smtp', error instanceof Error ? error.message : 'smtp');
  }
  const stored = await args.store.completeSend(draft.id, messageId, args.now, recipient);
  await args.store.recordAudit({
    id: `au_send_${draft.id}_${Date.now()}`,
    entity: 'draft',
    entityId: draft.id,
    action: 'sent',
    actor: 'adri',
    at: args.now,
    before: { status: draft.status, subject: draft.subject },
    after: { status: 'sent', subject: rendered.subject, recipient, messageId },
  });
  const followups = draft.kind === 'first_contact'
    ? await ensureFollowups(args.store, draft.prospectId, company?.name ?? draft.prospectId, rendered.lang)
    : [];
  let ghlNote: { status: 'saved' | 'skipped' | 'failed'; message?: string } = { status: 'skipped' };
  if (ghlWritesEnabled(args.env)) {
    ghlNote = await mirrorNote(args.store, args.deps, draft.prospectId, recipient, rendered, args.now);
  }
  return {
    ...sentPayload(stored ?? { ...draft, status: 'sent', messageId, sentAt: args.now, approvedAt: args.now, recipient, subject, body }, false),
    html: rendered.html,
    text: rendered.text,
    followups,
    ghlNote,
  };
}

export async function rememberOptOut(store: ReviewStore, emailRaw: string, now: string): Promise<{ email: string; domain: string | null }> {
  const email = normalizeEmail(emailRaw);
  if (!email) throw new InputError(['email']);
  const targets = optOutTargets(email);
  await store.addOptOut({ id: `opt_${email}`, email: targets.email, domain: null, at: now, by: 'adri' });
  if (targets.domain) await store.addOptOut({ id: `opt_dom_${targets.domain}`, email: null, domain: targets.domain, at: now, by: 'adri' });
  return targets;
}

export async function verifyMailbox(env: Env, mailer?: Mailer): Promise<void> {
  const checker = mailer ?? smtpMailer(env);
  if (!checker) throw new MailGateError(503, 'mail_not_configured', 'Falta GMAIL_SENDER o GMAIL_APP_PASSWORD.');
  const secret = readEnv(env, 'GMAIL_APP_PASSWORD') ?? '';
  try {
    await checker.verify();
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'smtp';
    throw new MailGateError(502, 'smtp', secret ? raw.split(secret).join('[redacted]') : raw);
  }
}

export async function createPipelineOpportunity(args: {
  store: ReviewStore;
  deps: GhlDeps;
  now: string;
  prospectId: string;
  name?: string;
  stage: Stage;
  status: GhlStatusName;
  monetaryValue: number | null;
}): Promise<{ opportunity: GhlOpportunity; contactId: string }> {
  const catalog = await args.store.loadCatalog();
  const prospect = catalog.prospects.find((row) => row.id === args.prospectId);
  if (!prospect) throw new InputError(['prospect']);
  const company = catalog.companies.find((row) => row.id === prospect.companyId);
  if (!company) throw new InputError(['company']);
  const email = sourcedEmail(catalog.contacts, prospect.id);
  if (!email) throw new MailGateError(400, 'no_recipient', 'No hay un correo de un contacto con fuente.');
  const created = await createGhlOpportunity(args.deps, {
    name: (args.name ?? company.name).trim(),
    stage: args.stage,
    status: args.status,
    monetaryValue: args.monetaryValue,
    contact: { name: (args.name ?? company.name).trim(), email, company: company.name },
  });
  await args.store.saveGhlLink({
    prospectId: prospect.id,
    opportunityId: created.opportunity.id,
    contactId: created.contactId,
    locationId: readEnv(args.deps.env, 'GHL_LOCATION_ID') ?? '',
  });
  await args.store.recordAudit({
    id: `au_ghl_${created.opportunity.id}_${Date.now()}`,
    entity: 'opportunity',
    entityId: created.opportunity.id,
    action: 'create',
    actor: 'adri',
    at: args.now,
    before: null,
    after: publicOpp(created.opportunity),
  });
  if (created.opportunity.stage) {
    await args.store.saveStage({ opportunityId: created.opportunity.id, stage: created.opportunity.stage, movedAt: args.now, by: 'adri', ghlSynced: true });
  }
  return { opportunity: created.opportunity, contactId: created.contactId ?? '' };
}

export async function updatePipelineOpportunity(args: {
  store: ReviewStore;
  deps: GhlDeps;
  now: string;
  id: string;
  name?: string;
  stage?: Stage;
  status?: GhlStatusName;
  monetaryValue?: number | null;
}): Promise<GhlOpportunity> {
  const result = await updateGhlOpportunity(args.deps, args.id, {
    name: args.name,
    stage: args.stage,
    status: args.status,
    monetaryValue: args.monetaryValue,
  });
  await args.store.recordAudit({
    id: `au_ghl_${args.id}_${Date.now()}`,
    entity: 'opportunity',
    entityId: args.id,
    action: 'update',
    actor: 'adri',
    at: args.now,
    before: publicOpp(result.before),
    after: publicOpp(result.after),
  });
  if (result.after.stage) {
    await args.store.saveStage({ opportunityId: args.id, stage: result.after.stage, movedAt: args.now, by: 'adri', ghlSynced: true });
  }
  return result.after;
}

export function parseGhlStatus(value: unknown): GhlStatusName {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!STATUSES.includes(status as GhlStatusName)) throw new InputError(['status']);
  return status as GhlStatusName;
}

export function parseStageKey(value: unknown): Stage {
  if (typeof value !== 'string' || !isStage(value)) throw new InputError(['stage']);
  return value;
}

export function parseMoney(value: unknown): number | null {
  if (value == null || value === '') return null;
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new InputError(['monetaryValue']);
  return amount;
}

export function sourcedEmail(contacts: CatalogContact[], prospectId: string): string | null {
  for (const contact of contacts) {
    if (contact.prospectId !== prospectId || contact.channel !== 'email') continue;
    if (!contact.source?.trim()) continue;
    const email = normalizeEmail(contact.value);
    if (email) return email;
  }
  return null;
}

async function ensureFollowups(store: ReviewStore, prospectId: string, company: string, lang: 'en' | 'es'): Promise<MailDraft[]> {
  const state = await store.load();
  const created: MailDraft[] = [];
  for (const day of FOLLOWUP_DAYS) {
    if (state.mailDrafts.some((row) => row.prospectId === prospectId && row.followupDay === day)) continue;
    const copy = defaultFollowup(company, day, lang);
    const draft: MailDraft = {
      id: `dr_${prospectId}_d${day}`,
      prospectId,
      kind: 'followup',
      followupDay: day,
      subject: copy.subject,
      body: copy.body,
      status: 'draft',
      recipient: null,
      messageId: null,
      approvedAt: null,
      sentAt: null,
    };
    await store.saveMailDraft(draft);
    created.push(draft);
  }
  return created;
}

async function mirrorNote(store: ReviewStore, deps: GhlDeps, prospectId: string, recipient: string, rendered: RenderedEmail, now: string): Promise<{ status: 'saved' | 'failed'; message?: string }> {
  const link = (await store.load()).ghlLinks.find((row) => row.prospectId === prospectId);
  if (!link?.contactId) return { status: 'failed', message: 'No hay un contacto de GHL para anotar el correo.' };
  try {
    await addGhlNote(deps, link.contactId, `Correo enviado ${now}\nPara: ${recipient}\nAsunto: ${rendered.subject}\n\n${rendered.text}`);
    return { status: 'saved' };
  } catch (error) {
    if (error instanceof GhlScopeError) return { status: 'failed', message: error.message };
    return { status: 'failed', message: 'No se pudo anotar el correo en GHL.' };
  }
}

function sentPayload(draft: MailDraft, idempotent: boolean): Record<string, unknown> {
  return {
    draftId: draft.id,
    status: 'sent',
    approvedAt: draft.approvedAt,
    sentAt: draft.sentAt,
    messageId: draft.messageId,
    recipient: draft.recipient,
    subject: draft.subject,
    send: 'sent',
    idempotent,
  };
}

function publicOpp(row: GhlOpportunity) {
  return {
    id: row.id,
    stage: row.stage,
    stageName: row.stageName,
    status: row.ghlStatus,
    outcome: row.outcome,
    name: row.name,
    statedValue: row.statedValue,
    updatedAt: row.updatedAt,
  };
}
