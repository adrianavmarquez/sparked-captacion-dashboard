import { NavLink, Outlet } from 'react-router-dom';
import { strings as t } from '../data/strings';
import { useStore, useQuery } from '../lib/store';
import { fmtDateTime } from '../lib/format';
import { Spark, Waves } from './ui';
import { now, type DemoMode } from '../data/adapter';
import { wordmarkWhite as wordmark, iconWhite } from '../assets/brand/logos';

const links: { to: string; label: string; key: 'review' | 'drafts' | 'followups' | null }[] = [
  { to: '/', label: t.nav.hoy, key: null },
  { to: '/prospectos', label: t.nav.prospectos, key: 'review' },
  { to: '/pipeline', label: t.nav.pipeline, key: null },
  { to: '/seguimientos', label: t.nav.seguimientos, key: 'followups' },
  { to: '/borradores', label: t.nav.borradores, key: 'drafts' },
  { to: '/criterios', label: t.nav.criterios, key: null },
  { to: '/ingresos', label: t.nav.ingresos, key: null },
];

function useCounts() {
  const q = useQuery(async (a) => {
    const [p, d, f] = await Promise.all([a.listProspects({ reviewState: 'pending' }, 1, 999), a.listDrafts(), a.listFollowups()]);
    const today = now().toISOString().slice(0, 10);
    return { review: p.total, drafts: d.filter((x) => x.status === 'draft').length, followups: f.filter((x) => !x.stopped && x.dueOn <= today && !(x.draftId && d.find((dr) => dr.id === x.draftId)?.status === 'sent')).length };
  });
  return q.status === 'ready' ? q.data : null;
}

function Nav({ className }: { className: string }) {
  const counts = useCounts();
  return (
    <nav className={className} aria-label="Secciones">
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} end={l.to === '/'}>
          <span>{l.label}</span>
          {l.key && counts && counts[l.key] > 0 && <span className="nav__count" aria-label={`${counts[l.key]} pendientes`}>{counts[l.key]}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      {compact ? (
        <>
          <img className="brand__icon" src={iconWhite} alt="" />
          <div>
            <div className="brand__name">Sparked Reactions</div>
            <div className="brand__area">{t.app.area}</div>
          </div>
        </>
      ) : (
        <div>
          <img className="brand__logo" src={wordmark} alt="Sparked Reactions" />
          <div className="brand__area" style={{ marginTop: 10 }}>{t.app.area}</div>
        </div>
      )}
    </div>
  );
}

export function Shell() {
  const { mode, setMode, persistence } = useStore();
  const meta = useQuery((a) => a.getMeta());
  const modes: DemoMode[] = ['normal', 'loading', 'empty', 'error', 'forbidden'];
  return (
    <div className="shell">
      <a className="skip" href="#main">{t.app.skip}</a>
      <aside className="sidebar">
        <Brand />
        <Nav className="nav" />
        <Waves className="sidebar__waves" dark />
        <div className="sidebar__foot" style={{ position: 'relative' }}>
          <strong>Adri y Chiri</strong><br />
          María construye, Adri aprueba.<br />
          {meta.status === 'ready' && <>Datos: {fmtDateTime(meta.data.updatedAt)}<br /></>}
          {persistence.label}
        </div>
      </aside>
      <div className="main">
        <div className="topbar"><Brand compact /></div>
        <Nav className="topbar__nav" />
        <div className="banner" role="note">
          <Spark className="banner__spark" />
          <span className="banner__text">{t.app.demoBanner} <strong style={{ fontWeight: 500 }}>{persistence.label}.</strong></span>
          <label className="banner__demo">
            <span>{t.demo.label}</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as DemoMode)}>
              {modes.map((m) => <option key={m} value={m}>{t.demo[m]}</option>)}
            </select>
          </label>
        </div>
        <main id="main" className="page" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
