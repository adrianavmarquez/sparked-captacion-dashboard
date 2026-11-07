import { Link } from 'react-router-dom';
import { strings as t } from '../data/strings';
import { useQuery } from '../lib/store';
import { fmtDate, fmtDateTime, daysFromToday } from '../lib/format';
import { DraftPill, Empty, Loaded, Note, PageHead } from '../components/ui';
import type { Followup, Draft, ProspectRow } from '../data/model';

export function Seguimientos() {
  const q = useQuery(async (a) => {
    const [followups, drafts, all] = await Promise.all([a.listFollowups(), a.listDrafts(), a.listProspects({}, 1, 999)]);
    return { followups, drafts, rows: all.items };
  });
  return (
    <>
      <PageHead title={t.seguimientos.title} sub={t.seguimientos.sub} />
      <Loaded q={q} rows={6}>
        {({ followups, drafts, rows }) => {
          const byProspect = new Map<string, Followup[]>();
          followups.forEach((f) => byProspect.set(f.prospectId, [...(byProspect.get(f.prospectId) ?? []), f]));
          if (byProspect.size === 0) return <div className="card"><Empty title={t.states.emptyTitle} body="Los seguimientos aparecen cuando un primer contacto se envía de verdad." /></div>;
          return (
            <div className="stack" style={{ gap: 'var(--s-4)' }}>
              <Note tone="butter">La secuencia se detiene si responden o piden baja. Nada se envía solo.</Note>
              <div className="grid grid--2">
                {[...byProspect.entries()].map(([pid, list]) => <Sequence key={pid} pid={pid} list={list} drafts={drafts} row={rows.find((r) => r.prospect.id === pid)} />)}
              </div>
            </div>
          );
        }}
      </Loaded>
    </>
  );
}

function Sequence({ pid, list, drafts, row }: { pid: string; list: Followup[]; drafts: Draft[]; row?: ProspectRow }) {
  const first = drafts.find((d) => d.prospectId === pid && d.kind === 'first_contact' && d.status === 'sent');
  const stopped = list.some((f) => f.stopped);
  return (
    <section className="card" aria-label={row?.company.name}>
      <Link to={`/prospectos/${pid}`} className="seq__title">{row?.company.name ?? pid}</Link>
      <div className="item__meta">{t.seguimientos.firstSent} {first?.sentAt ? fmtDateTime(first.sentAt) : t.common.pending} · {first ? t.channel[first.channel] : ''}</div>
      {stopped && <div style={{ marginTop: 8 }}><span className="pill pill--onyx">{t.seguimientos.stopped}: {t.seguimientos[list.find((f) => f.stopped)!.stopReason!]}</span></div>}
      <div style={{ marginTop: 8 }}>
        {list.sort((a, b) => a.day - b.day).map((f) => {
          const dr = drafts.find((d) => d.id === f.draftId);
          const delta = daysFromToday(f.dueOn);
          const state = f.stopped ? t.seguimientos.stopped : dr?.status === 'sent' ? t.draftStatus.sent : delta < 0 ? t.seguimientos.overdue : delta === 0 ? t.seguimientos.due : t.seguimientos.upcoming;
          const cls = f.stopped ? 'pill--ghost' : dr?.status === 'sent' ? 'pill--success' : delta < 0 ? 'pill--error' : delta === 0 ? 'pill--butter' : 'pill--outline';
          return (
            <div className="fu" key={f.id} style={{ opacity: f.stopped ? 0.55 : 1 }}>
              <div className="fu__day"><small>{t.seguimientos.day}</small>{f.day}</div>
              <div className="fu__body">
                <div className="fu__text">{fmtDate(f.dueOn)} <span className="page__meta">({delta === 0 ? 'hoy' : delta > 0 ? `en ${delta} d` : `hace ${-delta} d`})</span>{dr ? <> · {dr.subject}</> : f.stopped ? ' · secuencia detenida' : <> · {t.seguimientos.noDraft}</>}</div>
                <div className="fu__pills">
                  <span className={`pill ${cls}`}>{state}</span>
                  {dr && !f.stopped && dr.status !== 'sent' && <DraftPill value={dr.status} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
