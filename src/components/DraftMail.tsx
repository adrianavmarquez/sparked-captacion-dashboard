import { useEffect, useState } from 'react';
import { languageFor, renderSparkedEmail } from '../../server/email/render';
import { strings as t } from '../data/strings';
import type { Draft } from '../data/model';
import { useStore } from '../lib/store';
import { fmtDateTime } from '../lib/format';
import { Note } from './ui';

export function MailPreview({ subject, body, locality }: { subject: string; body: string; locality: string }) {
  const rendered = renderSparkedEmail({ subject, body, lang: languageFor(locality, body), level: 'cotidiano' });
  return (
    <div>
      <p className="page__meta" style={{ margin: '8px 0' }}>{t.borradores.subject}: {rendered.subject}</p>
      <iframe title={t.borradores.asSent} sandbox="" srcDoc={rendered.html} style={{ width: '100%', height: 520, border: '1px solid var(--line)', background: '#fff', borderRadius: 12 }} />
    </div>
  );
}

export function DraftMail({ draft, locality, recipient }: { draft: Draft; locality: string; recipient: string | null }) {
  const { adapter, toast, actor, capabilities } = useStore();
  const soloAdri = actor === 'chiri';
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setSubject(draft.subject);
    setBody(draft.body);
    setConfirming(false);
    setError(null);
  }, [draft.id, draft.status, draft.subject, draft.body]);

  const approveLocal = async () => {
    setBusy(true);
    try {
      await adapter.approveDraft(draft.id);
      toast(`${t.borradores.pending}. No se envió.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.borradores.pending);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await adapter.approveDraft(draft.id, { confirm: true, subject, body });
      setConfirming(false);
      toast(saved.sentAt ? `${t.draftStatus.sent} ${fmtDateTime(saved.sentAt)}` : t.borradores.pending);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.borradores.pending);
    } finally {
      setBusy(false);
    }
  };

  const optOut = async () => {
    if (!recipient || soloAdri) return;
    setBusy(true);
    try {
      await adapter.optOut(recipient);
      toast(t.borradores.optOut);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.borradores.pending);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {draft.status !== 'sent' && (
        <>
          <label className="field" style={{ marginTop: 8 }}>
            <span>{t.borradores.subject}</span>
            <input value={subject} disabled={soloAdri} onChange={(event) => setSubject(event.target.value)} />
          </label>
          <label className="field">
            <span>{t.borradores.plain}</span>
            <textarea value={body} disabled={soloAdri} onChange={(event) => setBody(event.target.value)} style={{ minHeight: 120 }} />
          </label>
        </>
      )}
      <p className="page__meta">{t.borradores.asSent}</p>
      <MailPreview subject={subject} body={body} locality={locality} />
      {draft.sentAt && <p className="page__meta">{t.borradores.sentOn} {fmtDateTime(draft.sentAt)}</p>}
      {error && <p className="page__meta" role="alert">{error}</p>}
      {confirming && (
        <div className="card card--flat" style={{ marginTop: 12 }}>
          <p className="card__label">{t.borradores.confirm}</p>
          <dl className="kv">
            <dt>Para</dt><dd>{recipient ?? t.borradores.noRecipient}</dd>
            <dt>{t.borradores.subject}</dt><dd>{subject}</dd>
          </dl>
          <MailPreview subject={subject} body={body} locality={locality} />
          <div className="row" style={{ gap: 10, marginTop: 10 }}>
            <button className="btn" type="button" disabled={busy || !recipient} onClick={() => { void send(); }}>{t.borradores.confirm}</button>
            <button className="btn btn--secondary" type="button" onClick={() => setConfirming(false)}>{t.borradores.confirmBack}</button>
          </div>
        </div>
      )}
      <div className="row" style={{ gap: 10, marginTop: 12 }}>
        {draft.status !== 'sent' && !capabilities.sends && <button className="btn" type="button" disabled={busy || soloAdri} onClick={() => { void approveLocal(); }}>{t.borradores.approve}</button>}
        {draft.status !== 'sent' && capabilities.sends && !confirming && <button className="btn" type="button" disabled={busy || soloAdri || !recipient} onClick={() => setConfirming(true)}>{t.borradores.approve}</button>}
        {recipient && draft.status !== 'sent' && <button className="btn btn--secondary" type="button" disabled={busy || soloAdri} onClick={() => { void optOut(); }}>{t.borradores.optOut}</button>}
        {soloAdri && <span className="page__meta">{t.ficha.soloAdri}</span>}
      </div>
      {!capabilities.sends && <p className="card__foot">{t.borradores.pending}. {t.borradores.sendHint}</p>}
      <Note tone="paper">{t.borradores.proofNote}</Note>
    </div>
  );
}
