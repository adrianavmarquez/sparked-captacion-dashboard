import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { strings as t } from '../data/strings';
import { useQuery, useStore } from '../lib/store';
import { freshnessOf } from '../data/adapter';
import { fmtDate, fmtDateTime, ageDays } from '../lib/format';
import { Empty, ExclusionPill, FreshnessPill, Loaded, Note, OfferPill, ReviewPill, StagePill, Verified } from '../components/ui';
import type { Decision, ProspectRow, AuditEvent, FitLevel, BudgetSignal, Offer } from '../data/model';

export function Ficha() {
  const { id = '' } = useParams();
  const q = useQuery(async (a) => {
    const [row, audit] = await Promise.all([a.getProspect(id), a.getAudit(id)]);
    return { row, audit };
  }, [id]);

  return (
    <Loaded q={q} rows={8}>
      {({ row, audit }) => row ? <FichaBody row={row} audit={audit} /> : (
        <Empty title={t.states.notFound} action={<Link className="btn btn--secondary btn--sm" to="/prospectos">{t.common.back}</Link>} />
      )}
    </Loaded>
  );
}

function FichaBody({ row, audit }: { row: ProspectRow; audit: AuditEvent[] }) {
  const { prospect, company, evidence, contacts, review, opportunity } = row;
  const best = contacts.find((c) => c.verified) ?? contacts[0];
  return (
    <>
      <p style={{ marginBottom: 12 }}><Link to="/prospectos" className="page__meta" style={{ textDecoration: 'none' }}>← {t.nav.prospectos}</Link></p>
      <div className="ficha__hero">
        <div>
          <h1 className="page__title">{company.name}</h1>
          <p className="page__sub">{company.industry} · {company.locality}{company.websiteUrl && <> · <a href={company.websiteUrl} target="_blank" rel="noreferrer">{company.websiteUrl.replace('https://', '')}</a></>}</p>
          <div className="row" style={{ marginTop: 10 }}>
            <ReviewPill value={row.reviewState} />
            <OfferPill value={prospect.offerInterest} />
            <FreshnessPill value={row.freshness} />
            <ExclusionPill value={prospect.exclusion} />
            {opportunity && <StagePill value={opportunity.stage} />}
          </div>
        </div>
        <div className="page__meta" style={{ whiteSpace: 'nowrap' }}>ID {prospect.id} · {fmtDate(prospect.createdAt)}</div>
      </div>

      <div className="ficha">
        <div className="stack" style={{ gap: 'var(--s-4)' }}>
          <section className="card">
            <h2 className="card__label">{t.ficha.summary}</h2>
            <p style={{ marginTop: 8, fontSize: 'var(--fs-lg)', lineHeight: 1.4, fontFamily: 'var(--font-display)', maxWidth: '62ch' }}>{prospect.summary}</p>
            <div className="card__foot">{t.common.source}: <a href={prospect.summarySource} target="_blank" rel="noreferrer">{prospect.summarySource}</a></div>
          </section>

          {prospect.exclusion && (
            <Note tone={prospect.exclusion === 'manual_review' ? 'butter' : 'paper'}>
              <strong>{t.ficha.exclusion}: {t.exclusion[prospect.exclusion]}.</strong>{' '}
              {prospect.exclusion === 'recently_renewed' && company.websiteRenewedOn && (
                <>{t.ficha.renewedOn} {fmtDate(company.websiteRenewedOn)}. {t.common.source}: <a href={company.websiteRenewedSource!} target="_blank" rel="noreferrer">{company.websiteRenewedSource}</a></>
              )}
              {prospect.exclusion === 'manual_review' && t.ficha.renewedNoDate}
            </Note>
          )}

          <section className="card" aria-labelledby="h-signal">
            <div className="row row--between">
              <h2 id="h-signal" className="card__label">{t.ficha.signal}</h2>
              <span className="pill pill--plain pill--sage">{t.common.level.confirmado}: 3 componentes</span>
            </div>
            <p className="page__meta" style={{ marginTop: 6, marginBottom: 14 }}>{t.evidence.gapNote}</p>
            {evidence.length === 0 ? <Empty title={t.states.noEvidence} body={t.states.noEvidenceBody} small /> : (
              <div className="stack">
                {evidence.map((e, i) => (
                  <article className="ev" key={e.id}>
                    <div className="ev__head">
                      <span className="ev__num">0{i + 1}</span>
                      <FreshnessPill value={freshnessOf(e.observedAt)} />
                    </div>
                    <div className="ev__title">{t.evidence[e.component]}</div>
                    <p className="ev__fact">{e.fact}</p>
                    <div className="ev__links">
                      <a href={e.url} target="_blank" rel="noreferrer">{t.common.source}</a>
                      {e.competitorUrl && <a href={e.competitorUrl} target="_blank" rel="noreferrer">{t.evidence.competitor}</a>}
                      <span>{t.evidence.observed} {fmtDateTime(e.observedAt)} ({ageDays(e.observedAt)} d)</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card" aria-labelledby="h-contact">
              <h2 id="h-contact" className="card__label">{t.ficha.contact}</h2>
              {contacts.length === 0 ? <Empty title={t.common.pending} small icon={false} /> : (
                <div className="stack" style={{ marginTop: 10, gap: 8 }}>
                  {contacts.map((c) => (
                    <div key={c.id} className="contact">
                      <span className="pill pill--plain pill--outline" style={{ flex: 'none' }}>{t.channel[c.channel]}</span>
                      <span className="contact__value">{c.value}</span>
                      <Verified ok={c.verified} />
                      {contacts.length > 1 && c === best && <span className="pill pill--plain pill--sky">mejor</span>}
                      <span className="page__meta contact__meta">{t.role[c.role]}{c.verifiedAt && <> · {fmtDate(c.verifiedAt)}</>}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
        </div>

        <div className="stack" style={{ gap: 'var(--s-4)' }}>
          <DecisionCard row={row} />
          <FitCard row={row} />
          <section className="card card--flat" aria-labelledby="h-hist">
            <h2 id="h-hist" className="card__label">{t.ficha.history}</h2>
            {audit.length === 0 ? <Empty title={t.hoy.nothingToday} small icon={false} /> : (
              <div className="timeline" style={{ marginTop: 14 }}>
                {audit.map((a) => (
                  <div className="tl" key={a.id}>
                    <span className="tl__dot" aria-hidden="true" />
                    <div>
                      <div>{a.action}</div>
                      <div className="tl__by">{a.by} · {fmtDateTime(a.at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          {review && review.decision !== 'approve_contact' && review.reason && (
            <Note tone="paper"><strong>{t.decision[review.decision]}:</strong> {review.reason}{review.revisitOn && <> · volver {fmtDate(review.revisitOn)}</>}</Note>
          )}
        </div>
      </div>
    </>
  );
}

function DecisionCard({ row }: { row: ProspectRow }) {
  const { adapter, toast, persistence } = useStore();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');
  const [revisit, setRevisit] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canContact = row.evidence.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision) return;
    setBusy(true); setErr(null);
    try {
      await adapter.saveReview({ prospectId: row.prospect.id, decision, reason, revisitOn: revisit });
      toast(`${t.ficha.saved} ${persistence.label}.`);
      setDecision(null); setReason(''); setRevisit('');
    } catch (ex) {
      setErr((ex as Error).message);
    } finally { setBusy(false); }
  };

  const opts: { v: Decision; d: string; disabled?: boolean }[] = [
    { v: 'approve_contact', d: canContact ? 'El prospecto puede contactarse. No aprueba el borrador ni el envío.' : 'Sin evidencia no se aprueba el contacto.', disabled: !canContact },
    { v: 'maybe', d: 'Con fecha para volver.' },
    { v: 'discard', d: 'Con razón obligatoria.' },
  ];

  return (
    <section className="card card--onyx" aria-labelledby="h-dec">
      <h2 id="h-dec" className="card__label">{t.ficha.decision}</h2>
      {row.review && (
        <p style={{ marginTop: 10, fontSize: 'var(--fs-sm)', color: 'var(--onyx-muted)' }}>
          {t.reviewState[row.reviewState]} · {fmtDateTime(row.review.decidedAt)}
        </p>
      )}
      <form className="decision" onSubmit={submit} style={{ marginTop: 14 }}>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="sr-only">{t.ficha.decision}</legend>
          <div className="decision__opts">
            {opts.map((o) => (
              <label key={o.v} className="opt" style={{ background: 'var(--onyx-soft)', borderColor: decision === o.v ? 'var(--vanilla)' : 'var(--onyx-line)', color: 'var(--vanilla)', opacity: o.disabled ? 0.5 : 1 }}>
                <input type="radio" name="decision" value={o.v} checked={decision === o.v} disabled={o.disabled} onChange={() => setDecision(o.v)} />
                <span><span className="opt__t" style={{ color: 'var(--vanilla)' }}>{t.decision[o.v]}</span><br /><span className="opt__d" style={{ color: 'var(--onyx-muted)' }}>{o.d}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        {decision === 'discard' && (
          <div className="field">
            <label htmlFor="reason" style={{ color: 'var(--onyx-muted)' }}>{t.ficha.reasonLabel}</label>
            <textarea id="reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
        {decision === 'maybe' && (
          <div className="field">
            <label htmlFor="revisit" style={{ color: 'var(--onyx-muted)' }}>{t.ficha.revisitLabel}</label>
            <input id="revisit" type="date" required value={revisit} onChange={(e) => setRevisit(e.target.value)} />
          </div>
        )}
        {err && <p role="alert" style={{ color: 'var(--butter)', fontSize: 'var(--fs-sm)' }}>{err}</p>}
        <div className="row">
          <button className="btn btn--sky" type="submit" disabled={!decision || busy}>{t.ficha.save}</button>
          <span className="pill pill--plain pill--ghost" style={{ color: 'var(--onyx-muted)', borderColor: 'var(--onyx-line)' }}>{persistence.short}</span>
        </div>
        <p className="card__foot">{t.ficha.threeSteps}</p>
      </form>
    </section>
  );
}

function FitCard({ row }: { row: ProspectRow }) {
  const { adapter, toast, persistence } = useStore();
  const cur = row.fit;
  const [fit, setFit] = useState<FitLevel | null>(cur?.fit ?? null);
  const [services, setServices] = useState<Offer[]>(cur?.services ?? []);
  const [budget, setBudget] = useState<BudgetSignal>(cur?.budget ?? 'sin_dato');
  const [note, setNote] = useState(cur?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const levels: FitLevel[] = ['buen_fit', 'fit_parcial', 'no_fit'];
  const offers: Offer[] = ['diagnostico', 'core', 'plus', 'cm'];
  const budgets: BudgetSignal[] = ['sin_dato', 'bajo', 'rango_core', 'rango_plus', 'abierto'];
  const toggle = (o: Offer) => setServices((s) => (s.includes(o) ? s.filter((x) => x !== o) : [...s, o]));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!fit) return;
    setBusy(true); setErr(null);
    try { await adapter.saveFit({ prospectId: row.prospect.id, fit, services, budget, note }); toast(`${t.ficha.fitSaved} ${persistence.label}.`); }
    catch (ex) { setErr((ex as Error).message); } finally { setBusy(false); }
  };
  const dirty = !cur || cur.fit !== fit || cur.budget !== budget || (cur.note ?? '') !== note || [...cur.services].sort().join() !== [...services].sort().join();
  return (
    <section className="card" aria-labelledby="h-fit">
      <div className="row row--between">
        <h2 id="h-fit" className="card__label">{t.ficha.fitTitle}</h2>
        <span className="pill pill--plain pill--sky" style={{ flex: 'none' }}>{t.common.level.propuesto}</span>
      </div>
      <p className="page__meta" style={{ marginTop: 6 }}>{t.ficha.fitSub}</p>
      {cur && (
        <p style={{ marginTop: 10, fontSize: 'var(--fs-sm)' }} className="row">
          <span className={`pill ${cur.fit === 'buen_fit' ? 'pill--success' : cur.fit === 'fit_parcial' ? 'pill--butter' : 'pill--ghost'}`}>{t.fit[cur.fit]}</span>
          {cur.services.map((o) => <OfferPill key={o} value={o} />)}
          <span className="page__meta">{t.ficha.fitCurrent}: {fmtDateTime(cur.decidedAt)}</span>
        </p>
      )}
      <form className="decision" onSubmit={submit} style={{ marginTop: 14 }}>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field" style={{ marginBottom: 8 }}><span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>{t.ficha.fitLevel}</span></legend>
          <div className="decision__opts">
            {levels.map((l) => (
              <label key={l} className="opt">
                <input type="radio" name="fit" value={l} checked={fit === l} onChange={() => setFit(l)} />
                <span><span className="opt__t">{t.fit[l]}</span><br /><span className="opt__d">{t.fitDesc[l]}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        {fit && fit !== 'no_fit' && (
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field" style={{ marginBottom: 8 }}><span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>{t.ficha.fitServices}</span></legend>
            <div className="row">
              {offers.map((o) => (
                <label key={o} className={`chip ${services.includes(o) ? 'chip--on' : ''}`}>
                  <input type="checkbox" className="sr-only" checked={services.includes(o)} onChange={() => toggle(o)} />
                  {t.offer[o]}{o === 'cm' && <span className="page__meta"> · solo con web</span>}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="field">
          <label htmlFor="budget">{t.ficha.fitBudget}</label>
          <select id="budget" value={budget} onChange={(e) => setBudget(e.target.value as BudgetSignal)}>
            {budgets.map((b) => <option key={b} value={b}>{t.budget[b]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fitnote">{t.ficha.fitNote}</label>
          <textarea id="fitnote" value={note} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 56 }} />
        </div>
        {err && <p role="alert" style={{ color: 'var(--error-ink)', fontSize: 'var(--fs-sm)' }}>{err}</p>}
        <div className="row">
          <button className="btn" type="submit" disabled={!fit || busy || !dirty}>{busy ? t.common.saving : t.ficha.fitSave}</button>
          <span className="pill pill--plain pill--ghost">{persistence.short}</span>
        </div>
      </form>
    </section>
  );
}
