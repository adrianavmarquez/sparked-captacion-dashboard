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
            const balance = amount === null ? null : amount - deposit;
            return { o, row, pv, amount, deposit, balance, fromList: !pv?.amountContracted };
          });
          const sum = (f: (l: typeof lines[number]) => number | null) => lines.reduce((acc, l) => acc + (f(l) ?? 0), 0);
          const anyNull = lines.some((l) => l.amount === null);
          return (
            <div className="stack" style={{ gap: 14 }}>
              <div className="grid grid--metrics">
                <section className="card metric"><div className="card__label">{t.ingresos.contracted}</div><div className="card__big">{anyNull ? '[Por definir]' : fmtMoney(sum((l) => l.amount))}</div><div className="metric__foot"><span className="metric__k">{lines.length} {lines.length === 1 ? 'oportunidad' : 'oportunidades'} en Closed</span></div></section>
                <section className="card card--sky metric"><div className="card__label">{t.ingresos.deposit}</div><div className="card__big">{fmtMoney(sum((l) => l.deposit))}</div><div className="metric__foot"><span className="metric__k">{lines.filter((l) => l.pv?.depositVerified).length} {lines.filter((l) => l.pv?.depositVerified).length === 1 ? 'anticipo verificado' : 'anticipos verificados'}</span></div></section>
                <section className="card card--butter metric"><div className="card__label">{t.ingresos.balance}</div><div className="card__big">{anyNull ? '[Por definir]' : fmtMoney(sum((l) => l.balance))}</div><div className="metric__foot"><span className="metric__k">Contratado menos anticipo</span></div></section>
              </div>
              <section className="card">
                <div className="row row--between">
                  <h2 className="card__label">Oportunidades en Closed</h2>
                  <span className="page__meta">{t.common.source}: pipeline (Closed) · precios de lista cuando no hay monto</span>
                </div>
                {lines.length === 0 ? <Empty title="Nada en Closed todavía" body="Cuando una oportunidad llegue a Closed en el pipeline, aparece aquí con su monto contratado." small /> : (
                  <div className="tablewrap card--flat" style={{ marginTop: 12, boxShadow: 'none' }}>
                    <table className="table table--compact">
                      <thead><tr><th scope="col">Negocio</th><th scope="col">Oferta</th><th scope="col">Contratado</th><th scope="col">Anticipo 50%</th><th scope="col">Saldo</th><th scope="col">Pago</th></tr></thead>
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

function PayRow({ o, row, pv, amount, deposit, balance, fromList }: { o: Opportunity; row?: ProspectRow; pv: PaymentVerification | null; amount: number | null; deposit: number; balance: number | null; fromList: boolean }) {
  const { adapter, toast, persistence } = useStore();
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(pv?.verifiedAt ? pv.verifiedAt.slice(0, 10) : '');
  const verified = !!pv?.depositVerified;
  const toggle = async () => {
    if (amount === null) return;
    setBusy(true);
    try { await adapter.markDeposit({ opportunityId: o.id, received: !verified, amountContracted: amount, verifiedOn: date || undefined }); toast(`${!verified ? 'Anticipo verificado' : 'Anticipo marcado como pendiente'}. ${persistence.label}.`); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <tr>
      <td><Link to={`/prospectos/${o.prospectId}`} className="name" style={{ textDecoration: 'none' }}>{row?.company.name ?? o.prospectId}</Link><div className="page__meta">{row?.company.industry} · Closed {fmtDate(o.updatedAt)}</div></td>
      <td>{row?.prospect.offerInterest ? t.offer[row.prospect.offerInterest] : t.offer.none}</td>
      <td><strong>{fmtMoney(amount)}</strong>{fromList && amount !== null && <div className="page__meta">precio de lista</div>}</td>
      <td>{verified ? <><strong>{fmtMoney(deposit)}</strong><div className="page__meta">{pv?.verifiedAt ? fmtDate(pv.verifiedAt) : ''}</div></> : <span className="pill pill--butter">Pendiente</span>}</td>
      <td><strong>{fmtMoney(balance)}</strong></td>
      <td>
        <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
          {!verified && <input type="date" aria-label="Fecha del anticipo" value={date} onChange={(e) => setDate(e.target.value)} style={{ border: '1px solid var(--line-strong)', borderRadius: 10, padding: '4px 8px', font: 'inherit', fontSize: 'var(--fs-xs)', background: 'var(--paper)' }} />}
          <button className={`btn btn--sm ${verified ? 'btn--secondary' : ''}`} onClick={toggle} disabled={busy || amount === null}>{verified ? 'Quitar verificación' : 'Marcar 50% recibido'}</button>
        </div>
      </td>
    </tr>
  );
}
