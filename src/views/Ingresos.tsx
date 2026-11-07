import { useState } from 'react';
import { Link } from 'react-router-dom';
import { strings as t } from '../data/strings';
import { useQuery, useStore } from '../lib/store';
import { fmtDate, fmtMoney } from '../lib/format';
import { Empty, Level, Loaded, Note, PageHead } from '../components/ui';
import type { Opportunity, PaymentVerification, ProspectRow } from '../data/model';

/** Precios de lista [CONFIRMADO]: solo se usan cuando la oportunidad no trae monto. */
const LIST_PRICE = { diagnostico: 495, core: 2850, plus: 4200 } as const;

export function Ingresos() {
  const q = useQuery(async (a) => {
    const [{ opportunities, payments }, all] = await Promise.all([a.listOpportunities(), a.listProspects({}, 1, 999)]);
    return { closed: opportunities.filter((o) => o.stage === 'closed'), payments, rows: all.items };
  });
  return (
    <>
      <PageHead title={t.ingresos.title} sub={t.ingresos.sub} right={<Level level="propuesto" />} />
      <Loaded q={q} rows={5}>
        {({ closed, payments, rows }) => {
          const lines = closed.map((o) => {
            const row = rows.find((r) => r.prospect.id === o.prospectId);
            const pv = payments.find((p) => p.opportunityId === o.id) ?? null;
            const offer = row?.prospect.offerInterest;
            const amount = pv?.amountContracted ?? (offer && offer !== 'cm' ? LIST_PRICE[offer] : null);
            const deposit = pv?.depositVerified ? pv.depositReceived ?? 0 : 0;
            const collected = deposit + (pv?.balanceVerifiedAt ? pv.balanceReceived ?? 0 : 0);
            const balance = amount === null ? null : amount - collected;
            return { o, row, pv, amount, deposit, collected, balance, fromList: !pv?.amountContracted };
          });
          const sum = (f: (l: typeof lines[number]) => number | null) => lines.reduce((acc, l) => acc + (f(l) ?? 0), 0);
          const anyNull = lines.some((l) => l.amount === null);
          return (
            <div className="stack" style={{ gap: 14 }}>
              <div className="grid grid--metrics">
                <section className="card metric"><div className="card__label">{t.ingresos.contracted}</div><div className="card__big">{anyNull ? '[Por definir]' : fmtMoney(sum((l) => l.amount))}</div><div className="metric__foot"><span className="metric__k">{lines.length} {lines.length === 1 ? 'oportunidad' : 'oportunidades'} en Closed</span></div></section>
                <section className="card card--sky metric"><div className="card__label">Cobrado</div><div className="card__big">{fmtMoney(sum((l) => l.collected))}</div><div className="metric__foot"><span className="metric__k">{lines.filter((l) => l.pv?.depositVerified).length} anticipo(s) · {lines.filter((l) => l.pv?.balanceVerifiedAt).length} saldo(s)</span></div></section>
                <section className="card card--butter metric"><div className="card__label">{t.ingresos.balance}</div><div className="card__big">{anyNull ? '[Por definir]' : fmtMoney(sum((l) => l.balance))}</div><div className="metric__foot"><span className="metric__k">Contratado menos cobrado</span></div></section>
              </div>
              <section className="card">
                <div className="row row--between">
                  <h2 className="card__label">Oportunidades en Closed</h2>
                  <span className="page__meta">{t.common.source}: pipeline (Closed) · precios de lista cuando no hay monto</span>
                </div>
                {lines.length === 0 ? <Empty title="Nada en Closed todavía" body="Cuando una oportunidad llegue a Closed en el pipeline, aparece aquí con su monto contratado." small /> : (
                  <div className="tablewrap card--flat" style={{ marginTop: 12, boxShadow: 'none' }}>
                    <table className="table table--compact table--auto">
                      <thead><tr><th scope="col">Negocio</th><th scope="col">Contratado</th><th scope="col">Anticipo 50%</th><th scope="col">Entrega</th><th scope="col">Saldo 50%</th><th scope="col">Pendiente</th></tr></thead>
                      <tbody>
                        {lines.map((l) => <PayRow key={l.o.id} {...l} />)}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <Note tone="butter">{t.ingresos.body}</Note>
            </div>
          );
        }}
      </Loaded>
    </>
  );
}

function PayRow({ o, row, pv, amount, balance, fromList }: { o: Opportunity; row?: ProspectRow; pv: PaymentVerification | null; amount: number | null; deposit: number; collected: number; balance: number | null; fromList: boolean }) {
  const half = amount === null ? null : Math.round(amount * 0.5);
  return (
    <tr>
      <td><Link to={`/prospectos/${o.prospectId}`} className="name" style={{ textDecoration: 'none' }}>{row?.company.name ?? o.prospectId}</Link><div className="page__meta">{row?.prospect.offerInterest ? t.offer[row.prospect.offerInterest] : t.offer.none} · Closed {fmtDate(o.updatedAt)}</div></td>
      <td><strong>{fmtMoney(amount)}</strong>{fromList && amount !== null && <div className="page__meta">precio de lista</div>}</td>
      <td><Step o={o} amount={amount} step="deposit" done={!!pv?.depositVerified} at={pv?.verifiedAt ?? null} value={half} /></td>
      <td><Step o={o} amount={amount} step="delivered" done={!!pv?.deliveredAt} at={pv?.deliveredAt ?? null} value={null} /></td>
      <td><Step o={o} amount={amount} step="balance" done={!!pv?.balanceVerifiedAt} at={pv?.balanceVerifiedAt ?? null} value={amount !== null && half !== null ? amount - half : null} /></td>
      <td><strong>{fmtMoney(balance)}</strong>{pv?.deliveredAt && balance === 0 && <div className="page__meta">cerrado y cobrado</div>}</td>
    </tr>
  );
}

const stepLabel = { deposit: 'Marcar recibido', delivered: 'Marcar entregado', balance: 'Marcar recibido' } as const;

function Step({ o, amount, step, done, at, value }: { o: Opportunity; amount: number | null; step: 'deposit' | 'delivered' | 'balance'; done: boolean; at: string | null; value: number | null }) {
  const { adapter, toast, persistence } = useStore();
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState('');
  const toggle = async () => {
    if (amount === null) return;
    setBusy(true);
    try { await adapter.setClosedStep({ opportunityId: o.id, step, done: !done, amountContracted: amount, on: date || undefined }); toast(`${done ? 'Hito quitado' : 'Hito registrado'}. ${persistence.label}.`); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  if (done) {
    return (
      <div className="step step--done">
        <span className="pill pill--success">{value !== null ? fmtMoney(value) : 'Entregado'}</span>
        <span className="page__meta">{at ? fmtDate(at) : ''} · <button className="linkbtn" onClick={toggle} disabled={busy}>quitar</button></span>
      </div>
    );
  }
  return (
    <div className="step">
      <input type="date" aria-label={`Fecha: ${stepLabel[step]}`} value={date} onChange={(e) => setDate(e.target.value)} className="step__date" />
      <button className="btn btn--sm btn--secondary" onClick={toggle} disabled={busy || amount === null}>{stepLabel[step]}</button>
    </div>
  );
}
