import { Link } from 'react-router-dom';
import { strings as t } from '../data/strings';
import { useQuery } from '../lib/store';
import { now } from '../data/adapter';
import { isActiveWebProject } from '../domain/income';
import { fmtDate, fmtDateShort, fmtDateTime, daysFromToday } from '../lib/format';
import { Empty, FreshnessPill, Loaded, PageHead, Spark, DraftPill, Waves } from '../components/ui';
import type { ProspectRow, Draft, Followup, GoalProgress, Opportunity, PaymentVerification } from '../data/model';

interface HoyData {
  goal: GoalProgress;
  toReview: ProspectRow[];
  revalidate: ProspectRow[];
  drafts: Draft[];
  allDrafts: Draft[];
  followups: Followup[];
  rows: ProspectRow[];
  opportunities: Opportunity[];
  payments: PaymentVerification[];
}

export function Hoy() {
  const q = useQuery<HoyData>(async (a) => {
    const [goal, all, drafts, followups, opp] = await Promise.all([
      a.getGoalProgress(), a.listProspects({}, 1, 999), a.listDrafts(), a.listFollowups(), a.listOpportunities(),
    ]);
    return {
      goal,
      toReview: all.items.filter((r) => r.reviewState === 'pending' && r.evidence.length > 0),
      revalidate: all.items.filter((r) => r.reviewState !== 'discarded' && (r.freshness === 'revalidar' || r.freshness === 'obsoleta')),
      drafts: drafts.filter((d) => d.status === 'draft'),
      allDrafts: drafts,
      followups, rows: all.items, opportunities: opp.opportunities, payments: opp.payments,
    };
  });

  const today = now().toISOString().slice(0, 10);
  const name = (rows: ProspectRow[], id: string) => rows.find((r) => r.prospect.id === id)?.company.name ?? id;

  return (
    <>
      <Waves className="page__waves" />
      <PageHead title={t.hoy.title} sub={`${t.hoy.sub} ${fmtDate(today)}, ${t.app.tz}.`} />
      <Loaded q={q} rows={6}>
        {(d) => {
          const due = d.followups.filter((f) => !f.stopped && daysFromToday(f.dueOn) <= 0 && !isSent(f, d));
          const offerOf = (id: string) => d.rows.find((r) => r.prospect.id === id)?.prospect.offerInterest ?? null;
          const activeWebs = d.opportunities.filter((o) => isActiveWebProject({ offer: offerOf(o.prospectId), stage: o.stage, payment: d.payments.find((p) => p.opportunityId === o.id) ?? null })).length;
          const delivered = d.payments.filter((p) => p.deliveredAt && d.opportunities.some((o) => o.id === p.opportunityId && o.stage === 'closed' && offerOf(o.prospectId) !== 'cm' && offerOf(o.prospectId) !== null)).length;
          return (
            <div className="stack" style={{ gap: 14 }}>
              <GoalCard goal={d.goal} />

              <div className="grid grid--metrics">
                <Link to="/prospectos?state=pending" className="card metric" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="card__label">{t.hoy.toReview}</div>
                  <div className="card__big">{d.toReview.length}</div>
                  <div className="metric__foot">{d.toReview.length ? <><span className="metric__k">{t.hoy.next}:</span> {d.toReview[0].company.name}</> : t.hoy.nothingToday}</div>
                </Link>
                <Link to="/borradores" className="card card--sky metric" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="card__label">{t.hoy.toApprove}</div>
                  <div className="card__big">{d.drafts.length}</div>
                  <div className="metric__foot">{d.drafts.length ? <><span className="metric__k">{t.hoy.next}:</span> {name(d.rows, d.drafts[0].prospectId)}</> : t.hoy.nothingToday}</div>
                </Link>
                <section className="card card--butter metric" aria-labelledby="h-cap">
                  <div id="h-cap" className="card__label" role="heading" aria-level={2}>{t.hoy.capacity}</div>
                  <div className="row" style={{ alignItems: 'flex-end', gap: 14 }}>
                    <div className="card__big">{activeWebs}<small>/ 3</small></div>
                    <div className="row" style={{ gap: 5, marginBottom: 6 }} aria-hidden="true">
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i} style={{ width: 22, height: 22, borderRadius: 8, background: i < activeWebs ? 'var(--espresso)' : 'rgba(82,49,41,0.12)', border: i === 3 ? '1px dashed var(--line-strong)' : 'none' }} />
                      ))}
                    </div>
                  </div>
                  <div className="metric__foot" title={t.hoy.capacityBody}>{activeWebs === 1 ? `1 ${t.hoy.capacityOne}` : `${activeWebs} ${t.hoy.capacityMany}`} <span className="metric__k">(máx. 4{delivered ? ` · ${delivered} entregada${delivered > 1 ? 's' : ''}` : ''})</span></div>
                </section>
              </div>

              <section className="card" aria-labelledby="h-rv">
                <div className="row row--between">
                  <h2 id="h-rv" className="card__label">{t.hoy.revalidate} <span className="pill pill--plain pill--onyx">{d.revalidate.length}</span></h2>
                  <Link to="/prospectos?fresh=revalidar" className="page__meta">{t.hoy.seeAll}</Link>
                </div>
                {d.revalidate.length === 0 ? <Empty title={t.hoy.nothingToday} small icon={false} /> : (
                  <div className="items items--2">
                    {d.revalidate.map((r) => (
                      <div className="item" key={r.prospect.id}>
                        <div>
                          <Link className="item__title" to={`/prospectos/${r.prospect.id}`}>{r.company.name}</Link>
                          <div className="item__meta">{r.company.industry} · {t.evidence.observed.toLowerCase()} {fmtDateShort(r.evidence[0].observedAt)}</div>
                        </div>
                        <FreshnessPill value={r.freshness} />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="card" aria-labelledby="h-fu">
                <div className="row row--between">
                  <h2 id="h-fu" className="card__label">{t.hoy.dueFollowups} <span className="pill pill--plain pill--onyx">{due.length}</span></h2>
                  <Link to="/seguimientos" className="page__meta">{t.hoy.seeAll}</Link>
                </div>
                {due.length === 0 ? <Empty title={t.hoy.nothingToday} small icon={false} /> : (
                  <div className="items items--2">
                    {due.map((f) => (
                      <div className="item" key={f.id}>
                        <div>
                          <Link className="item__title" to={`/prospectos/${f.prospectId}`}>{name(d.rows, f.prospectId)}</Link>
                          <div className="item__meta">{t.seguimientos.day} {f.day} · {fmtDateShort(f.dueOn)} · {daysFromToday(f.dueOn) < 0 ? t.seguimientos.overdue.toLowerCase() : t.seguimientos.due.toLowerCase()}</div>
                        </div>
                        {f.draftId ? <DraftPill value={d.allDrafts.find((x) => x.id === f.draftId)?.status ?? 'draft'} /> : <span className="pill pill--ghost">{t.seguimientos.noDraft}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          );
        }}
      </Loaded>
    </>
  );
}

function isSent(f: Followup, d: HoyData) {
  return !!f.draftId && d.allDrafts.find((x) => x.id === f.draftId)?.status === 'sent';
}

function GoalCard({ goal }: { goal: GoalProgress }) {
  const n = goal.verifiedSales;
  return (
    <section className="card card--onyx goal" aria-labelledby="h-goal">
      <div>
        <div className="card__label"><Spark className="spark" size={12} /> {t.hoy.goalTitle} <span style={{ color: 'var(--onyx-muted)', letterSpacing: 0, textTransform: 'none' }}>· {t.hoy.goalWindow}</span></div>
        {n === 0 ? (
          <>
            <h2 id="h-goal" className="card__title" style={{ marginTop: 8 }}>{t.hoy.goalEmpty}</h2>
            <p style={{ color: 'var(--onyx-muted)', fontSize: 'var(--fs-sm)', marginTop: 4 }}>{t.hoy.goalEmptyBody}</p>
          </>
        ) : (
          <h2 id="h-goal" className="card__big">{n}<small>/ {goal.target}</small></h2>
        )}
      </div>
      <div className="goal__right">
        <div className="goalbar" aria-label={`${n} de ${goal.target} ventas verificadas`} role="img">
          {Array.from({ length: goal.target }).map((_, i) => <span key={i} className={i < n ? 'on' : i < n + goal.signedPendingDeposit ? 'half' : ''} />)}
        </div>
        <div className="card__foot" style={{ marginTop: 8 }}>
          {goal.signedPendingDeposit > 0 ? <>{goal.signedPendingDeposit} {t.hoy.goalSigned}</> : <>Ventas verificadas: {goal.verifiedSales}</>}<br />
          {t.common.source}: fixtures demo · {fmtDateTime(goal.updatedAt)}
        </div>
      </div>
    </section>
  );
}
