import { strings as t } from '../data/strings';
import { Level, PageHead, Note, Loaded, Empty } from '../components/ui';
import { useQuery } from '../lib/store';

type L = 'confirmado' | 'propuesto' | 'pendiente' | 'operativa';
interface Rule { t: string; d: string; l: L; date?: string }

const groups: { title: string; rules: Rule[] }[] = [
  { title: 'Meta y ventas', rules: [
    { t: 'Meta: al menos 10 websites', d: 'Entre el 7 nov 2026 y el 7 feb 2027 (ET). Solo cuentan webs.', l: 'confirmado', date: '7 nov 2026' },
    { t: 'Qué cuenta como venta', d: 'Entregables: contrato firmado + 50% adelantado. Mensualidad: firma + mes completo adelantado.', l: 'confirmado' },
    { t: 'Avance a la meta', d: 'Ventas verificadas / 10. Sin pronósticos, probabilidades ni montos estimados. Toda cifra con fuente y fecha.', l: 'confirmado' },
    { t: 'Pago', d: 'Solo "verificado sí/no" con fecha. Nunca datos de tarjeta ni cuenta.', l: 'confirmado' },
  ] },
  { title: 'Señal de oportunidad', rules: [
    { t: 'Tres componentes con URL y fecha', d: 'Presencia social desactualizada; menor visibilidad observable frente al competidor (comparación actual, sin afirmar caída histórica); competidor local con mejor presencia (link + hecho).', l: 'confirmado' },
    { t: 'Es una brecha, no dinero perdido', d: 'No se muestran pérdidas estimadas.', l: 'confirmado' },
    { t: 'Ventana del dolor', d: 'El problema puede llevar 12 meses o más; importa que persista hoy. No es un corte duro.', l: 'operativa' },
    { t: 'Frescura de evidencia', d: 'Evidencia de 30 días o menos. Revalidar si tiene más de 7 días antes del primer borrador. Estados: Fresca, Revalidar, Obsoleta.', l: 'operativa' },
  ] },
  { title: 'Exclusiones', rules: [
    { t: 'Cadenas y franquicias', d: 'Se descartan.', l: 'confirmado' },
    { t: 'Web recién renovada', d: 'Solo con fecha de fuente. Si la fecha es dudosa: revisión manual, no descarte automático.', l: 'confirmado' },
  ] },
  { title: 'Decisiones de Adri', rules: [
    { t: 'Descartar, Maybe y Aprobar contacto', d: 'Son las tres salidas de la revisión. Qualified es etapa de pipeline y ocurre después de contactar.', l: 'confirmado' },
    { t: 'Descartar con razón obligatoria', d: '', l: 'propuesto' },
    { t: 'Maybe con fecha para volver', d: '', l: 'propuesto' },
    { t: 'Tres pasos separados', d: 'Aprobar contacto, aprobar borrador y enviar. Nada sale sin Adri.', l: 'confirmado' },
  ] },
  { title: 'Contacto y envío', rules: [
    { t: 'Canales aprobados', d: 'Email y LinkedIn.', l: 'confirmado' },
    { t: 'Marca verificado / no verificado en el contacto', d: '', l: 'propuesto' },
    { t: 'Estados del borrador', d: 'Borrador → Aprobado por Adri → Enviado. Guardado no es enviado. El envío lo presiona una persona.', l: 'confirmado' },
    { t: 'Prueba citable en outreach', d: 'Solo sparkedreactions.com como muestra. Sin resultados, casos ni métricas inventadas.', l: 'confirmado' },
    { t: 'Diseño del correo saliente', d: 'Formato 3, nivel Cotidiano: 2 a 3 párrafos, una acción, firma. Fira Sans 15/1.6, blanco, 640 px, títulos Espresso.', l: 'confirmado', date: '6 nov 2026' },
  ] },
  { title: 'Seguimientos', rules: [
    { t: 'Días 4, 10 y 20', d: 'Contados desde el envío efectivo del primer contacto, no desde la aprobación. Cada uno es un borrador que Adri revisa.', l: 'confirmado' },
    { t: 'La secuencia se detiene', d: 'Si responden o piden baja.', l: 'confirmado' },
  ] },
  { title: 'Pipeline y capacidad', rules: [
    { t: 'Etapas en GHL', d: 'New Lead, Contacted, Qualified, Proposal Sent, Negotiation, Closed (leídas 7 nov 2026).', l: 'confirmado' },
    { t: 'Mover etapas arrastrando', d: 'El movimiento se guarda en el dashboard con fecha y autor. La escritura hacia GHL queda pendiente de la integración de María.', l: 'propuesto', date: '7 nov 2026, pedido por Adri' },
    { t: 'Qualified = encaja + confirmó interés. Closed = firma + depósito.', d: '', l: 'confirmado' },
    { t: 'Condiciones de las demás etapas', d: 'New Lead = fit y contacto listo; Contacted = envío efectivo; Proposal Sent = propuesta enviada; Negotiation = condiciones en discusión.', l: 'propuesto' },
    { t: 'Capacidad web', d: '3 clientes a la vez para empezar, máximo 4, sin contar CM.', l: 'confirmado' },
    { t: 'CM', d: 'Solo a quien contrata web primero. Unas 4 cuentas activas con inicios escalonados (estimación de Adri). No se muestra capacidad combinada.', l: 'confirmado' },
  ] },
  { title: 'Pendiente', rules: [
    { t: 'Fit y presupuesto', d: 'No se infiere. Campo "Por definir".', l: 'pendiente' },
    { t: 'Variante de español de la marca', d: '', l: 'pendiente' },
    { t: 'Tokens de UI y usos tipográficos', d: 'La paleta está confirmada; los usos en UI son propuesta de esta demo.', l: 'pendiente' },
    { t: 'Hitos después de Closed', d: 'Anticipo 50%, entrega y saldo 50%, cada uno con fecha. Entregado libera capacidad web.', l: 'propuesto', date: '7 nov 2026, pedido por Adri' },
  ] },
];

export function Criterios() {
  const q = useQuery((a) => a.getDiscardReasons());
  return (
    <>
      <PageHead title={t.criterios.title} sub={t.criterios.sub} />
      <div className="stack" style={{ gap: 'var(--s-4)' }}>
        <Note tone="sage">Niveles: <Level level="confirmado" /> decidido por Adri con fecha · <Level level="propuesto" /> sugerencia ajustable · <Level level="operativa" /> elegida por María por delegación · <Level level="pendiente" /> no existe dato.</Note>
        <section className="card" aria-labelledby="h-reasons">
          <div className="row row--between">
            <h2 id="h-reasons" className="card__label">{t.criterios.reasons}</h2>
            <span className="page__meta">{t.criterios.reasonsSub}</span>
          </div>
          <Loaded q={q} rows={2}>
            {(reasons) => reasons.length === 0 ? <Empty title={t.criterios.reasonsEmpty} small icon={false} /> : (
              <div className="items items--2">
                {reasons.map((r) => (
                  <div className="item" key={r.reason}>
                    <div className="item__title" style={{ whiteSpace: 'normal' }}>{r.reason}</div>
                    <span className="pill pill--plain pill--onyx">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </Loaded>
        </section>
        <div className="grid grid--2">
          {groups.map((g) => (
            <section className="card" key={g.title} aria-labelledby={`g-${g.title}`}>
              <h2 id={`g-${g.title}`} className="card__label">{g.title}</h2>
              <div style={{ marginTop: 6 }}>
                {g.rules.map((r) => (
                  <div className="rule" key={r.t}>
                    <div>
                      <div className="rule__t">{r.t}</div>
                      {r.d && <div className="rule__d">{r.d}</div>}
                      {r.date && <div className="page__meta" style={{ marginTop: 4 }}>{r.date}</div>}
                    </div>
                    <Level level={r.l} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

