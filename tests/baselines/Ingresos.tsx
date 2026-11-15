import { useState } from 'react';
import { Link } from 'react-router-dom';
import { strings as t } from '../data/strings';
import { useQuery, useStore } from '../lib/store';
import { fmtDate, fmtMoney } from '../lib/format';
import { Empty, Level, Loaded, Note, PageHead } from '../components/ui';
import type { Opportunity, PaymentVerification, ProspectRow } from '../data/model';
import { incomeLine, incomeTotals, type IncomeLine } from '../domain/income';

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
            const calc = incomeLine({ offer: row?.prospect.offerInterest ?? pv?.offer ?? null, stage: o.stage, payment: pv });
            return { o, row, pv, calc };
          });
          const totals = incomeTotals(lines.map((l) => l.calc));
          const big = (n: number | null) => n === null ? '[Por definir]' : fmtMoney(n);
          return (
            <div className="stack" style={{ gap: 14 }}>
              <div className="grid grid--metrics">
                <section className="card metric"><div className="card__label">{t.ingresos.contracted}</div><div className="card__big">{big(totals.contracted)}</div><div className="metric__foot"><span className="metric__k">{lines.length} {lines.length === 1 ? 'oportunidad' : 'oportunidades'} en Closed</span></div></section>
                <section className="card card--sky metric"><div className="card__label">Cobrado</div><div className="card__big">{big(totals.paidCash)}</div><div className="metric__foot"><span className="metric__k">{lines.filter((l) => l.pv?.depositVerified && l.pv.depositReceived != null).length} anticipo(s) con monto · {lines.filter((l) => l.pv?.balanceVerifiedAt && l.pv.balanceReceived != null).length} saldo(s) con monto</span></div></section>
                <section className="card card--butter metric"><div className="card__label">{t.ingresos.balance}</div><div className="card__big">{big(totals.balance)}</div><div className="metric__foot"><span className="metric__k">Contratado menos caja verificada</span></div></section>
              </div>
              <section className="card">
                <div className="row row--between">
                  <h2 className="card__label">Oportunidades en Closed</h2>
                  <span className="page__meta">{t.common.source}: pipeline (Closed) · sin monto registrado queda por definir</span>
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

function PayRow({ o, row, pv, calc }: { o: Opportunity; row?: ProspectRow; pv: PaymentVerification | null; calc: IncomeLine }) {
  const cash = (step: 'deposit' | 'balance') => step === 'deposit'
    ? (pv?.depositVerified ? pv.depositReceived ?? null : null)
    : (pv?.balanceVerifiedAt ? pv.balanceReceived ?? null : null);
  return (
    <tr>
      <td><Link to={`/prospectos/${o.prospectId}`} className="name" style={{ textDecoration: 'none' }}>{row?.company.name ?? o.prospectId}</Link><div className="page__meta">{row?.prospect.offerInterest ? t.offer[row.prospect.offerInterest] : t.offer.none} · Closed {fmtDate(o.updatedAt)}</div></td>
      <td><strong>{fmtMoney(calc.contracted)}</strong></td>
      <td>
        <Step o={o} amount={calc.contracted} offer={row?.prospect.offerInterest ?? null} step="deposit" done={!!(pv?.depositMarkedAt || pv?.depositVerified)} at={pv?.verifiedAt ?? pv?.depositMarkedAt ?? null} value={cash('deposit')} expected={calc.expectedDeposit} />
      </td>
      <td><Step o={o} amount={calc.contracted} offer={row?.prospect.offerInterest ?? null} step="delivered" done={!!pv?.deliveredAt} at={pv?.deliveredAt ?? null} value={null} expected={null} /></td>
      <td><Step o={o} amount={calc.contracted} offer={row?.prospect.offerInterest ?? null} step="balance" done={!!(pv?.balanceMarkedAt || pv?.balanceVerifiedAt)} at={pv?.balanceVerifiedAt ?? pv?.balanceMarkedAt ?? null} value={cash('balance')} expected={null} /></td>
      <td><strong>{fmtMoney(calc.balance)}</strong>{pv?.deliveredAt && calc.balance === 0 && <div className="page__meta">cerrado y cobrado</div>}</td>
    </tr>
  );
}

const stepLabel = { deposit: 'Marcar recibido', delivered: 'Marcar entregado', balance: 'Marcar recibido' } as const;

function Step({ o, amount, offer, step, done, at, value, expected }: { o: Opportunity; amount: number | null; offer: ProspectRow['prospect']['offerInterest']; step: 'deposit' | 'delivered' | 'balance'; done: boolean; at: string | null; value: number | null; expected: number | null }) {
  const { adapter, toast, persistence } = useStore();
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState('');
  const toggle = async () => {
    setBusy(true);
    try {
      await adapter.setClosedStep({ opportunityId: o.id, step, done: !done, amountContracted: amount, on: date || undefined, offer });
      toast(`${done ? 'Hito quitado' : 'Hito registrado'}. ${persistence.label}.`);
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  if (done) {
    const label = step === 'delivered' ? 'Entregado' : value !== null ? fmtMoney(value) : 'Sin caja verificada';
    return (
      <div className="step step--done">
        <span className="pill pill--success">{label}</span>
        <span className="page__meta">{at ? fmtDate(at) : ''} · <button className="linkbtn" onClick={toggle} disabled={busy}>quitar</button></span>
      </div>
    );
  }
  return (
    <div className="step">
      {step === 'deposit' && expected !== null && <div className="page__meta">esperado {fmtMoney(expected)}</div>}
      <input type="date" aria-label={`Fecha: ${stepLabel[step]}`} value={date} onChange={(e) => setDate(e.target.value)} className="step__date" />
      <button className="btn btn--sm btn--secondary" onClick={toggle} disabled={busy || (step !== 'delivered' && amount === null)}>{stepLabel[step]}</button>
    </div>
  );
}
