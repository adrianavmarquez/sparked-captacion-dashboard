import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { strings as t } from '../data/strings';
import { useQuery } from '../lib/store';
import { fmtDate, fmtDateShort } from '../lib/format';
import { Empty, ExclusionPill, FreshnessPill, Loaded, OfferPill, PageHead, ReviewPill, Verified } from '../components/ui';
import type { ProspectFilters, ProspectRow } from '../data/model';

const PAGE = 8;

export function Prospectos() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const filters: ProspectFilters = useMemo(() => ({
    query: sp.get('q') ?? '',
    offer: (sp.get('offer') as ProspectFilters['offer']) ?? 'all',
    reviewState: (sp.get('state') as ProspectFilters['reviewState']) ?? 'all',
    locality: sp.get('loc') ?? 'all',
    freshness: (sp.get('fresh') as ProspectFilters['freshness']) ?? 'all',
    exclusion: (sp.get('excl') as ProspectFilters['exclusion']) ?? 'all',
    fit: (sp.get('fit') as ProspectFilters['fit']) ?? 'all',
    sort: (sp.get('sort') as ProspectFilters['sort']) ?? 'recent',
  }), [sp]);
  const page = Math.max(1, Number(sp.get('p') ?? 1));
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (!v || v === 'all') n.delete(k); else n.set(k, v);
    if (k !== 'p') n.delete('p');
    setSp(n, { replace: true });
  };
  const hasFilters = [...sp.keys()].some((k) => k !== 'p' && k !== 'state');
  const tabs: [string, string][] = [['pending', t.reviewState.pending], ['approved', t.reviewState.approved], ['maybe', t.reviewState.maybe], ['discarded', t.reviewState.discarded], ['all', t.prospectos.tabAll]];

  const q = useQuery(async (a) => {
    const [res, localities, all] = await Promise.all([a.listProspects(filters, page, PAGE), a.getLocalities(), a.listProspects({}, 1, 999)]);
    const counts = { all: all.total, pending: 0, approved: 0, maybe: 0, discarded: 0 };
    all.items.forEach((r) => { counts[r.reviewState] += 1; });
    return { res, localities, counts };
  }, [filters, page]);

  const open = (r: ProspectRow) => nav(`/prospectos/${r.prospect.id}`);

  return (
    <>
      <PageHead title={t.prospectos.title} sub={t.prospectos.sub} />
      <div className="tabs" role="tablist" aria-label={t.prospectos.fState}>
        {tabs.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={filters.reviewState === v} className={`tab ${filters.reviewState === v ? 'tab--on' : ''}`} onClick={() => set('state', v)}>
            {l} <span className="tab__n">{q.data?.counts[v as keyof typeof q.data.counts] ?? ''}</span>
          </button>
        ))}
      </div>
      <form className="toolbar" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="q">{t.common.search}</label>
          <input id="q" type="search" placeholder={t.prospectos.searchPh} value={filters.query} onChange={(e) => set('q', e.target.value)} />
        </div>
        <Select id="offer" label={t.prospectos.fOffer} value={filters.offer!} onChange={(v) => set('offer', v)}
          options={[['all', t.common.all], ['diagnostico', t.offer.diagnostico], ['core', t.offer.core], ['plus', t.offer.plus], ['cm', t.offer.cm]]} />
        <Select id="fit" label={t.prospectos.fFit} value={filters.fit!} onChange={(v) => set('fit', v)}
          options={[['all', t.common.all], ['buen_fit', t.fit.buen_fit], ['fit_parcial', t.fit.fit_parcial], ['no_fit', t.fit.no_fit], ['none', t.prospectos.fitNone]]} />
        <Select id="loc" label={t.prospectos.fLocality} value={filters.locality!} onChange={(v) => set('loc', v)}
          options={[['all', t.common.all], ...(q.data?.localities ?? []).map((l) => [l, l] as [string, string])]} />
        <Select id="fresh" label={t.prospectos.fFresh} value={filters.freshness!} onChange={(v) => set('fresh', v)}
          options={[['all', t.common.all], ['fresca', t.freshness.fresca], ['revalidar', t.freshness.revalidar], ['obsoleta', t.freshness.obsoleta], ['sin_evidencia', t.freshness.sin_evidencia]]} />
        <Select id="excl" label={t.prospectos.fExcl} value={filters.exclusion!} onChange={(v) => set('excl', v)}
          options={[['all', t.common.all], ['none', t.exclusion.none], ['chain', t.exclusion.chain], ['franchise', t.exclusion.franchise], ['recently_renewed', t.exclusion.recently_renewed], ['manual_review', t.exclusion.manual_review]]} />
        <Select id="sort" label="Orden" value={filters.sort!} onChange={(v) => set('sort', v === 'recent' ? '' : v)}
          options={[['recent', t.prospectos.sortRecent], ['fit', t.prospectos.sortFit]]} />
        <button type="button" className="btn btn--secondary" onClick={() => { const n = new URLSearchParams(); if (sp.get('state')) n.set('state', sp.get('state')!); setSp(n, { replace: true }); }} disabled={!hasFilters}>{t.common.clear}</button>
      </form>

      <div className="tablewrap">
        <Loaded q={q} rows={8}>
          {({ res }) => res.total === 0 ? (
            hasFilters ? <Empty title={t.states.noResultsTitle} body={t.states.noResultsBody} /> : <Empty title={t.states.emptyTitle} body={t.states.emptyBody} />
          ) : (
            <>
              <table className="table">
                <caption className="sr-only">{t.prospectos.title}</caption>
                <colgroup><col className="c-name" /><col className="c-offer" /><col className="c-ev" /><col className="c-rev" /><col className="c-contact" /><col className="c-created hide-md" /></colgroup>
                <thead>
                  <tr>
                    <th scope="col">{t.prospectos.cols.name}</th>
                    <th scope="col">{t.prospectos.cols.offer}</th>
                    <th scope="col">{t.prospectos.cols.evidence}</th>
                    <th scope="col">{t.prospectos.cols.state}</th>
                    <th scope="col">{t.prospectos.cols.contact}</th>
                    <th scope="col" className="hide-md">{t.prospectos.cols.created}</th>
                  </tr>
                </thead>
                <tbody>
                  {res.items.map((r) => {
                    const best = r.contacts[0];
                    return (
                      <tr key={r.prospect.id} className="trow" tabIndex={0} role="link" aria-label={`${t.common.open} ${r.company.name}`}
                        onClick={() => open(r)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(r); } }}>
                        <td>
                          <div className="row" style={{ gap: 6, flexWrap: 'nowrap', overflow: 'hidden' }}><span className="name" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.company.name}</span>{r.prospect.exclusion && <ExclusionPill value={r.prospect.exclusion} short />}</div>
                          <div className="page__meta row" style={{ gap: 6, flexWrap: 'nowrap', overflow: 'hidden' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.company.industry} · {r.company.locality}</span>{r.fit && <span className={`pill pill--plain ${r.fit.fit === 'buen_fit' ? 'pill--success' : r.fit.fit === 'fit_parcial' ? 'pill--butter' : 'pill--ghost'}`} style={{ flex: 'none' }}>{t.fit[r.fit.fit]}</span>}</div>
                        </td>
                        <td><OfferPill value={r.prospect.offerInterest} /></td>
                        <td><FreshnessPill value={r.freshness} /></td>
                        <td><ReviewPill value={r.reviewState} /></td>
                        <td>{best ? <span className={`pill ${best.verified ? 'pill--success' : 'pill--outline'}`} title={best.verified ? t.common.verified : t.common.unverified}>{t.channel[best.channel]} {best.verified ? '✓' : '· sin verificar'}</span> : <span className="mono">{t.common.pending}</span>}</td>
                        <td className="mono hide-md" title={fmtDate(r.prospect.createdAt)}>{fmtDateShort(r.prospect.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="cards">
                {res.items.map((r) => (
                  <button key={r.prospect.id} className="rowcard" onClick={() => open(r)}>
                    <span className="rowcard__title"><span>{r.company.name}</span><ReviewPill value={r.reviewState} /></span>
                    <span className="rowcard__meta">{r.company.industry} · {r.company.locality} · {fmtDate(r.prospect.createdAt)}</span>
                    <span className="rowcard__pills"><OfferPill value={r.prospect.offerInterest} /><FreshnessPill value={r.freshness} /><ExclusionPill value={r.prospect.exclusion} />{r.contacts[0] && <Verified ok={r.contacts[0].verified} />}</span>
                  </button>
                ))}
              </div>
              <div className="table__foot">
                <span>{res.total} {t.common.results} · {t.common.page} {res.page} {t.common.of} {Math.max(1, Math.ceil(res.total / PAGE))}</span>
                <span className="row">
                  <button className="btn btn--secondary btn--sm" disabled={page <= 1} onClick={() => set('p', String(page - 1))}>{t.common.prev}</button>
                  <button className="btn btn--secondary btn--sm" disabled={page * PAGE >= res.total} onClick={() => set('p', String(page + 1))}>{t.common.next}</button>
                </span>
              </div>
            </>
          )}
        </Loaded>
      </div>
    </>
  );
}

function Select({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
