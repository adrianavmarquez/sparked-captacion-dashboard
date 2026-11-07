import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { strings as t } from '../data/strings';
import { useQuery, useStore } from '../lib/store';
import { fmtDate, fmtDateTime } from '../lib/format';
import { DisabledBtn, Level, Loaded, PageHead } from '../components/ui';
import type { Stage, Opportunity, PaymentVerification, ProspectRow } from '../data/model';

const stages: Stage[] = ['new_lead', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'closed'];
const confirmedStages: Stage[] = ['qualified', 'closed'];

interface Drag { id: string; name: string; x: number; y: number; w: number; over: Stage | null }

export function Pipeline() {
  const { adapter, toast, persistence } = useStore();
  const nav = useNavigate();
  const q = useQuery(async (a) => {
    const [{ opportunities, payments }, all] = await Promise.all([a.listOpportunities(), a.listProspects({}, 1, 999)]);
    return { opportunities, payments, rows: all.items };
  });
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const press = useRef<{ id: string; name: string; x: number; y: number; w: number; timer: number | null; started: boolean; moved: boolean } | null>(null);

  const move = async (id: string, stage: Stage) => {
    try { await adapter.moveStage({ opportunityId: id, stage }); toast(`${t.pipeline.moved} ${t.stage[stage]}. ${persistence.label}.`); }
    catch (e) { toast((e as Error).message); }
  };

  // ----- arrastre con Pointer Events (mouse y táctil) -----
  const onPointerDown = (e: React.PointerEvent, o: Opportunity, name: string) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const el = e.currentTarget as HTMLElement;
    const w = el.getBoundingClientRect().width;
    const start = () => {
      press.current!.started = true;
      const d: Drag = { id: o.id, name, x: e.clientX, y: e.clientY, w, over: null };
      dragRef.current = d; setDrag(d);
    };
    // táctil: pulsación sostenida (220 ms); mouse: arranca al mover 6 px
    const timer = e.pointerType === 'mouse' ? null : window.setTimeout(start, 220);
    press.current = { id: o.id, name, x: e.clientX, y: e.clientY, w, timer, started: false, moved: false };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current; if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (!p.started) {
      if (Math.hypot(dx, dy) > 6) {
        if (e.pointerType === 'mouse') { p.started = true; const d: Drag = { id: p.id, name: p.name, x: e.clientX, y: e.clientY, w: p.w, over: null }; dragRef.current = d; setDrag(d); }
        else if (p.timer) { clearTimeout(p.timer); p.timer = null; press.current = null; return; } // scroll táctil, no arrastre
      }
      return;
    }
    p.moved = true;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-stage]');
    const over = (target?.dataset.stage as Stage | undefined) ?? null;
    const d: Drag = { ...dragRef.current!, x: e.clientX, y: e.clientY, over };
    dragRef.current = d; setDrag(d);
    e.preventDefault();
  };
  const onPointerUp = (e: React.PointerEvent, o: Opportunity) => {
    const p = press.current; press.current = null;
    if (p?.timer) clearTimeout(p.timer);
    const d = dragRef.current; dragRef.current = null; setDrag(null);
    if (p && !p.started) { nav(`/prospectos/${o.prospectId}`); return; } // tap/clic simple abre la ficha
    if (d?.over && d.over !== o.stage) void move(o.id, d.over);
    e.preventDefault();
  };
  useEffect(() => {
    if (!drag) return;
    const prev = document.body.style.userSelect; document.body.style.userSelect = 'none';
    return () => { document.body.style.userSelect = prev; };
  }, [drag]);

  const onKey = (e: React.KeyboardEvent, o: Opportunity) => {
    const i = stages.indexOf(o.stage);
    if (e.key === 'ArrowRight' && i < stages.length - 1) { e.preventDefault(); void move(o.id, stages[i + 1]); }
    if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); void move(o.id, stages[i - 1]); }
    if (e.key === 'Enter') { e.preventDefault(); nav(`/prospectos/${o.prospectId}`); }
  };

  return (
    <>
      <PageHead title={t.pipeline.title} sub={t.pipeline.sub} meta={t.pipeline.readFrom}
        right={<DisabledBtn label={t.pipeline.connect} variant="btn--secondary" />} />
      <Loaded q={q} rows={6}>
        {({ opportunities, payments, rows }) => (
          <>
            <div className={`kanban ${drag ? 'kanban--dragging' : ''}`}>
              {stages.map((s) => {
                const items = opportunities.filter((o) => o.stage === s);
                const isOver = drag?.over === s;
                return (
                  <section className={`col ${isOver ? 'col--over' : ''}`} key={s} aria-labelledby={`col-${s}`} data-stage={s}>
                    <div className="col__head"><span id={`col-${s}`}>{t.stage[s]}</span><span>{items.length}</span></div>
                    <div className="col__cond" title={t.stageCond[s]}><Level level={confirmedStages.includes(s) ? 'confirmado' : 'propuesto'} /> <span>{t.stageCond[s]}</span></div>
                    {items.length === 0 && !isOver && <p className="page__meta" style={{ padding: '12px 4px' }}>{t.pipeline.empty}</p>}
                    {items.map((o) => (
                      <OppCard key={o.id} o={o} row={rows.find((x) => x.prospect.id === o.prospectId)} pay={payments.find((p) => p.opportunityId === o.id)}
                        dragging={drag?.id === o.id}
                        onPointerDown={(e) => onPointerDown(e, o, rows.find((x) => x.prospect.id === o.prospectId)?.company.name ?? o.prospectId)}
                        onPointerMove={onPointerMove} onPointerUp={(e) => onPointerUp(e, o)} onKeyDown={(e) => onKey(e, o)} />
                    ))}
                    {isOver && <div className="col__drop" aria-hidden="true" />}
                  </section>
                );
              })}
            </div>
            <p className="page__meta" style={{ marginTop: 12 }}>{t.pipeline.dragHint} · {t.pipeline.lossReasons} · {t.common.updated} {fmtDateTime(q.data!.opportunities[0]?.updatedAt ?? '2026-11-07T14:00:00-05:00')}</p>
            {drag && (
              <div className="opp opp--ghost" style={{ left: drag.x - drag.w / 2, top: drag.y - 24, width: drag.w }} aria-hidden="true">
                <span className="opp__name">{drag.name}</span>
                <span className="opp__meta">{drag.over ? `→ ${t.stage[drag.over]}` : t.pipeline.dragHint.split('.')[0]}</span>
              </div>
            )}
          </>
        )}
      </Loaded>
    </>
  );
}

function OppCard({ o, row, pay, dragging, ...handlers }: {
  o: Opportunity; row?: ProspectRow; pay?: PaymentVerification; dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void; onPointerMove: (e: React.PointerEvent) => void; onPointerUp: (e: React.PointerEvent) => void; onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <div className={`opp opp--draggable ${dragging ? 'opp--lifted' : ''}`} tabIndex={0} role="button"
      aria-label={`${row?.company.name ?? o.prospectId}, ${t.stage[o.stage]}. Enter abre la ficha; flechas cambian de etapa.`}
      {...handlers} onPointerCancel={handlers.onPointerUp}>
      <span className="opp__grip" aria-hidden="true">⋮⋮</span>
      <span className="opp__name">{row?.company.name ?? o.prospectId}</span>
      <span className="opp__meta">{row?.company.industry} · {fmtDate(o.updatedAt)}</span>
      {o.stage === 'closed' && (
        <span className="opp__pills">
          <span className={`pill ${pay?.contractSigned ? 'pill--success' : 'pill--outline'}`}>{pay?.contractSigned ? 'Firmado' : 'Sin firma'}</span>
          <span className={`pill ${pay?.depositVerified ? 'pill--success' : 'pill--butter'}`}>{pay?.depositVerified ? 'Anticipo ok' : 'Anticipo pendiente'}</span>
        </span>
      )}
    </div>
  );
}
