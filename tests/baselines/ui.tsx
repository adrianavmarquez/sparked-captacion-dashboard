import type { ReactNode } from 'react';
import { strings as t } from '../data/strings';
import type { Freshness, ReviewState, DraftStatus, Stage, Offer, Exclusion } from '../data/model';
import type { QueryState } from '../lib/store';
import { AdapterError } from '../data/adapter';

/** Estrella de cuatro puntas del brand board. */
export function Spark({ className, size = 14 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 0c.6 7.2 4.8 11.4 12 12-7.2.6-11.4 4.8-12 12C11.4 16.8 7.2 12.6 0 12 7.2 11.4 11.4 7.2 12 0z" />
    </svg>
  );
}

export function Level({ level }: { level: 'confirmado' | 'propuesto' | 'pendiente' | 'operativa' }) {
  const cls = level === 'confirmado' ? 'pill--sage' : level === 'propuesto' ? 'pill--sky' : level === 'operativa' ? 'pill--butter' : 'pill--outline';
  return <span className={`pill pill--plain ${cls}`}>{t.common.level[level]}</span>;
}

export function FreshnessPill({ value }: { value: Freshness | 'sin_evidencia' }) {
  const cls = value === 'fresca' ? 'pill--success' : value === 'revalidar' ? 'pill--butter' : value === 'obsoleta' ? 'pill--error' : 'pill--ghost';
  return <span className={`pill ${cls}`}>{t.freshness[value]}</span>;
}

export function ReviewPill({ value }: { value: ReviewState }) {
  const cls = value === 'approved' ? 'pill--sky' : value === 'maybe' ? 'pill--butter' : value === 'discarded' ? 'pill--ghost' : 'pill--onyx';
  return <span className={`pill ${cls}`}>{t.reviewState[value]}</span>;
}

export function DraftPill({ value }: { value: DraftStatus }) {
  const cls = value === 'sent' ? 'pill--success' : value === 'approved' ? 'pill--sky' : 'pill--outline';
  return <span className={`pill ${cls}`}>{t.draftStatus[value]}</span>;
}

export function StagePill({ value }: { value: Stage }) {
  const cls = value === 'closed' ? 'pill--success' : value === 'new_lead' ? 'pill--outline' : 'pill--sage';
  return <span className={`pill pill--plain ${cls}`}>{t.stage[value]}</span>;
}

export function OfferPill({ value }: { value: Offer | null }) {
  if (!value) return <span className="pill pill--plain pill--ghost">{t.offer.none}</span>;
  return <span className="pill pill--plain pill--outline">{t.offer[value]}</span>;
}

const exclusionShort: Record<Exclusion, string> = { chain: 'Cadena', franchise: 'Franquicia', recently_renewed: 'Web nueva', manual_review: 'Revisar' };
export function ExclusionPill({ value, short }: { value: Exclusion | null; short?: boolean }) {
  if (!value) return null;
  return <span className={`pill pill--plain ${value === 'manual_review' ? 'pill--butter' : 'pill--error'}`} title={t.exclusion[value]} style={{ flex: 'none' }}>{short ? exclusionShort[value] : t.exclusion[value]}</span>;
}

export function Verified({ ok }: { ok: boolean }) {
  return <span className={`pill ${ok ? 'pill--success' : 'pill--outline'}`}>{ok ? t.common.verified : t.common.unverified}</span>;
}

export function Pending({ label = t.common.pending }: { label?: string }) {
  return <span className="pill pill--plain pill--ghost">[{label}]</span>;
}

export function Empty({ title, body, icon = true, small, action }: { title: string; body?: string; icon?: boolean; small?: boolean; action?: ReactNode }) {
  return (
    <div className={`empty ${small ? 'empty--sm' : ''}`}>
      {icon && <Spark className="empty__spark" size={28} />}
      <div className="empty__title">{title}</div>
      {body && <p className="empty__body">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: AdapterError; retry?: () => void }) {
  const forbidden = error.code === 'forbidden';
  return (
    <div className={`empty ${forbidden ? '' : 'empty--error'}`} role="alert">
      <Spark className="empty__spark" size={28} />
      <div className="empty__title">{forbidden ? t.states.forbiddenTitle : t.states.errorTitle}</div>
      <p className="empty__body">{forbidden ? t.states.forbiddenBody : t.states.errorBody}</p>
      {!forbidden && retry && <button className="btn btn--secondary btn--sm" onClick={retry}>{t.common.retry}</button>}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t.common.loading}</span>
      {Array.from({ length: rows }).map((_, i) => <div key={i} className={`skel ${i === 0 ? 'skel--lg' : ''}`} style={{ width: `${100 - (i * 13) % 40}%` }} />)}
    </div>
  );
}

/** Envuelve un estado de consulta y renderiza cargando/error/listo. */
export function Loaded<T>({ q, children, rows }: { q: QueryState<T> & { reload: () => void }; children: (data: T) => ReactNode; rows?: number }) {
  if (q.status === 'loading') return <Skeleton rows={rows} />;
  if (q.status === 'error') return <ErrorState error={q.error} retry={q.reload} />;
  return <>{children(q.data)}</>;
}

export function PageHead({ title, sub, meta, right }: { title: string; sub?: string; meta?: string; right?: ReactNode }) {
  return (
    <header className="page__head">
      <div>
        <h1 className="page__title">{title}</h1>
        {sub && <p className="page__sub">{sub}</p>}
        {meta && <p className="page__meta" style={{ marginTop: 8 }}>{meta}</p>}
      </div>
      {right}
    </header>
  );
}

export function Note({ children, tone = 'sky' }: { children: ReactNode; tone?: 'sky' | 'butter' | 'sage' | 'paper' }) {
  return <div className={`note note--${tone}`}><Spark size={12} /><div>{children}</div></div>;
}

export function DisabledBtn({ label, hint, variant = '' }: { label: string; hint?: string; variant?: string }) {
  return (
    <span className="row" style={{ gap: 10 }}>
      <button className={`btn ${variant}`} disabled aria-disabled="true" title={t.common.integrationPending}>{label}</button>
      <span className="pill pill--plain pill--ghost">{t.common.integrationPending}</span>
      {hint && <span className="sr-only">{hint}</span>}
    </span>
  );
}

/** Líneas onduladas del brand board, para fondos. Decorativo. */
export function Waves({ className, dark = false }: { className?: string; dark?: boolean }) {
  const c = dark ? ['#F5EDE3', '#D9EBFA', '#FAE6B8'] : ['#523129', '#D9EBFA', '#FAE6B8'];
  return (
    <svg className={className} viewBox="0 0 520 260" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <path d="M-20 60c70-60 120-60 190 0s120 60 190 0 120-60 190 0" stroke={c[0]} strokeWidth="22" strokeLinecap="round" opacity={dark ? 0.08 : 0.08} />
      <path d="M-20 140c70-60 120-60 190 0s120 60 190 0 120-60 190 0" stroke={c[1]} strokeWidth="22" strokeLinecap="round" opacity={dark ? 0.16 : 0.9} />
      <path d="M-20 220c70-60 120-60 190 0s120 60 190 0 120-60 190 0" stroke={c[2]} strokeWidth="22" strokeLinecap="round" opacity={dark ? 0.14 : 0.9} />
    </svg>
  );
}
