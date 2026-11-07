import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { strings as t } from '../data/strings';
import { useQuery, useStore } from '../lib/store';
import { fmtDateTime } from '../lib/format';
import { DisabledBtn, DraftPill, Empty, Loaded, Note, PageHead } from '../components/ui';
import type { Draft, ProspectRow } from '../data/model';

export function Borradores() {
  const q = useQuery(async (a) => {
    const [drafts, all] = await Promise.all([a.listDrafts(), a.listProspects({}, 1, 999)]);
    return { drafts, rows: all.items };
  });
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { if (q.status === 'ready' && !sel && q.data.drafts.length) setSel(q.data.drafts.find((d) => d.status === 'draft')?.id ?? q.data.drafts[0].id); }, [q, sel]);

  return (
    <>
      <PageHead title={t.borradores.title} sub={t.borradores.sub} />
      <Loaded q={q} rows={6}>
        {({ drafts, rows }) => {
          if (drafts.length === 0) return <div className="card"><Empty title={t.states.emptyTitle} body="María crea un borrador cuando apruebas un contacto." /></div>;
          const order = { draft: 0, approved: 1, sent: 2 };
          const sorted = [...drafts].sort((a, b) => order[a.status] - order[b.status]);
          const current = drafts.find((d) => d.id === sel) ?? sorted[0];
          const row = rows.find((r) => r.prospect.id === current.prospectId);
          return (
            <div className="drafts">
              <div className="draftlist" role="list">
                {sorted.map((d) => (
                  <button key={d.id} role="listitem" className="draftbtn" aria-pressed={d.id === current.id} onClick={() => setSel(d.id)}>
                    <span className="draftbtn__t">{rows.find((r) => r.prospect.id === d.prospectId)?.company.name}</span>
                    <span className="draftbtn__m"><DraftPill value={d.status} /> {t.channel[d.channel]} · {d.kind === 'first_contact' ? 'Primer contacto' : `${t.seguimientos.day} ${d.followupDay}`}</span>
                  </button>
                ))}
              </div>
              <Preview draft={current} row={row} />
            </div>
          );
        }}
      </Loaded>
    </>
  );
}

function Preview({ draft, row }: { draft: Draft; row?: ProspectRow }) {
  const { adapter, toast } = useStore();
  const [busy, setBusy] = useState(false);
  const approve = async () => {
    setBusy(true);
    try { await adapter.approveDraft(draft.id); toast('Borrador aprobado en memoria de la demo. No se envió.'); } finally { setBusy(false); }
  };
  const paragraphs = draft.body.split('\n\n');
  return (
    <section className="card" aria-labelledby="h-prev">
      <div className="row row--between">
        <div>
          <h2 id="h-prev" className="card__label">{t.borradores.preview} · {t.channel[draft.channel]}</h2>
          <div style={{ marginTop: 4 }}><Link to={`/prospectos/${draft.prospectId}`} className="seq__title" style={{ fontSize: 'var(--fs-md)' }}>{row?.company.name}</Link></div>
        </div>
        <DraftPill value={draft.status} />
      </div>
      <dl className="kv" style={{ margin: '14px 0' }}>
        <dt>{t.borradores.subject}</dt><dd>{draft.subject}</dd>
        {draft.approvedAt && <><dt>{t.borradores.approvedOn}</dt><dd>{fmtDateTime(draft.approvedAt)}</dd></>}
        {draft.sentAt && <><dt>{t.borradores.sentOn}</dt><dd>{fmtDateTime(draft.sentAt)} (por una persona)</dd></>}
      </dl>

      {draft.channel === 'email' ? (
        <div className="email" aria-label="Previsualización esquemática del correo">
          <h3>{draft.subject}</h3>
          {paragraphs.map((p, i) => {
            if (p.trim() === '[Firma]') return <div key={i} className="email__sig">[Firma]</div>;
            if (i === paragraphs.length - 2 && draft.kind === 'first_contact') return <div key={i} className="email__next">{p}</div>;
            return <p key={i}>{p}</p>;
          })}
        </div>
      ) : (
        <div className="li-msg">{draft.body}</div>
      )}

      <details style={{ marginTop: 14 }}>
        <summary className="page__meta" style={{ cursor: 'pointer' }}>{t.borradores.plain}</summary>
        <pre className="plain" style={{ marginTop: 8 }}>{draft.subject}{'\n\n'}{draft.body}</pre>
      </details>

      <hr className="hr" />
      <div className="row" style={{ gap: 10 }}>
        {draft.status === 'draft' && <button className="btn" onClick={approve} disabled={busy}>{t.borradores.approve}</button>}
        <DisabledBtn label={t.borradores.send} variant={draft.status === 'approved' ? '' : 'btn--secondary'} hint={t.borradores.sendHint} />
      </div>
      <p className="card__foot" style={{ marginTop: 8 }}>{t.borradores.sendHint}</p>
      <Note tone="paper">{t.borradores.proofNote}</Note>
    </section>
  );
}
