/**
 * DATOS FICTICIOS. Ningún negocio, persona, URL ni contacto es real.
 * Los dominios usan ".invalid" (reservado, nunca resuelve).
 * La "fecha de hoy" de la demo está fijada en DEMO_NOW para que los cálculos
 * de frescura y seguimientos sean reproducibles en capturas.
 */
import type {
  Dataset, Company, Prospect, Evidence, Contact, Review, Opportunity,
  PaymentVerification, Draft, Followup, AuditEvent, Offer, Exclusion, Stage, FitAssessment, AgentStep,
} from './model';

/** Hora del Este (ET). */
export const DEMO_NOW = '2026-11-07T15:00:00-05:00';
export const GOAL_WINDOW = { start: '2026-11-07', end: '2027-02-07' };

const d = (day: number, hour = 10) => {
  // día relativo a DEMO_NOW (negativo = pasado), en ET
  const base = new Date('2026-11-07T00:00:00-05:00');
  base.setUTCDate(base.getUTCDate() + day);
  base.setUTCHours(base.getUTCHours() + hour);
  return base.toISOString();
};
const date = (day: number) => d(day).slice(0, 10);

interface Seed {
  key: string; name: string; locality: string; industry: string; offer: Offer | null;
  chain?: boolean; renewedOn?: string | null; renewedSource?: string | null;
  exclusion?: Exclusion | null; evidenceAge: number; createdAge: number;
  summary: string;
}

const seeds: Seed[] = [
  { key: 'A', name: 'Negocio de ejemplo A', locality: 'Ciudad Ejemplo Norte', industry: 'Restaurante', offer: 'core', evidenceAge: 2, createdAge: 3,
    summary: 'Restaurante familiar con 12 años en el barrio. Web de una sola página sin menú actualizado. Instagram activo hasta hace 7 meses.' },
  { key: 'B', name: 'Negocio de ejemplo B', locality: 'Ciudad Ejemplo Norte', industry: 'Clínica dental', offer: 'plus', evidenceAge: 9, createdAge: 12,
    summary: 'Clínica con dos sedes. Sitio sin versión móvil. Reseñas recientes mencionan dificultad para pedir cita en línea.' },
  { key: 'C', name: 'Negocio de ejemplo C', locality: 'Villa Ejemplo', industry: 'Gimnasio', offer: 'core', evidenceAge: 4, createdAge: 5,
    summary: 'Gimnasio independiente. Página de Facebook sin publicaciones desde enero. Sin web propia; usa un perfil de directorio.' },
  { key: 'D', name: 'Negocio de ejemplo D', locality: 'Puerto Ejemplo', industry: 'Boutique', offer: 'diagnostico', evidenceAge: 1, createdAge: 1,
    summary: 'Tienda de ropa con catálogo solo por WhatsApp. Web en constructor gratuito con dominio de terceros.' },
  { key: 'E', name: 'Negocio de ejemplo E', locality: 'Villa Ejemplo', industry: 'Estudio de yoga', offer: 'core', evidenceAge: 34, createdAge: 40,
    summary: 'Estudio con horarios publicados en un PDF. Último post en redes hace 11 meses.' },
  { key: 'F', name: 'Negocio de ejemplo F', locality: 'Ciudad Ejemplo Sur', industry: 'Inmobiliaria', offer: 'plus', evidenceAge: 3, createdAge: 20,
    summary: 'Inmobiliaria local con listados desactualizados en la web. Competidor directo publica tours en video cada semana.' },
  { key: 'G', name: 'Negocio de ejemplo G', locality: 'Ciudad Ejemplo Sur', industry: 'Cafetería', offer: 'diagnostico', evidenceAge: 6, createdAge: 8,
    summary: 'Cafetería de especialidad. Buen producto según reseñas; presencia digital limitada a un perfil de mapas.' },
  { key: 'H', name: 'Negocio de ejemplo H', locality: 'Puerto Ejemplo', industry: 'Veterinaria', offer: 'core', evidenceAge: 12, createdAge: 15,
    summary: 'Veterinaria con web de 2019, sin HTTPS. Instagram con publicaciones esporádicas.' },
  { key: 'I', name: 'Cadena de ejemplo I', locality: 'Ciudad Ejemplo Norte', industry: 'Comida rápida', offer: null, chain: true, exclusion: 'chain', evidenceAge: 5, createdAge: 6,
    summary: 'Sucursal de una cadena nacional. Marketing centralizado.' },
  { key: 'J', name: 'Negocio de ejemplo J', locality: 'Villa Ejemplo', industry: 'Peluquería', offer: null, renewedOn: date(-18), renewedSource: 'https://ejemplo.invalid/j/blog/nueva-web', exclusion: 'recently_renewed', evidenceAge: 5, createdAge: 7,
    summary: 'Peluquería con web renovada hace menos de un mes según su propio anuncio.' },
  { key: 'K', name: 'Negocio de ejemplo K', locality: 'Ciudad Ejemplo Sur', industry: 'Taller mecánico', offer: 'core', renewedOn: null, renewedSource: null, exclusion: 'manual_review', evidenceAge: 3, createdAge: 4,
    summary: 'Taller con web que parece reciente, pero no hay fecha verificable de renovación. Requiere revisión manual antes de decidir.' },
  { key: 'L', name: 'Negocio de ejemplo L', locality: 'Puerto Ejemplo', industry: 'Floristería', offer: 'diagnostico', evidenceAge: 2, createdAge: 2,
    summary: 'Floristería con pedidos por teléfono. Sin web. Competidor local vende en línea con entrega el mismo día.' },
  { key: 'M', name: 'Negocio de ejemplo M', locality: 'Ciudad Ejemplo Norte', industry: 'Academia de idiomas', offer: 'plus', evidenceAge: 8, createdAge: 30,
    summary: 'Academia con web funcional pero sin inscripción en línea. Redes activas, contenido sin dirección clara.' },
  { key: 'N', name: 'Negocio de ejemplo N', locality: 'Villa Ejemplo', industry: 'Panadería', offer: 'core', evidenceAge: 1, createdAge: 45,
    summary: 'Panadería artesanal. Cerró una venta con Sparked (contrato firmado). Depósito en verificación.' },
];

const whyNowOf = (k: string): Prospect['whyNow'] => {
  const map: Record<string, { fact: string; days: number }> = {
    A: { fact: 'Abrió segunda terraza y anunció delivery propio en redes.', days: 9 },
    B: { fact: 'Inauguró segunda sede; la web sigue mostrando una sola dirección.', days: 20 },
    D: { fact: 'Lanzó colección nueva solo por WhatsApp; sin catálogo en línea.', days: 4 },
    F: { fact: 'Competidor directo empezó tours en video semanales.', days: 12 },
    L: { fact: 'Temporada alta (bodas) empieza en 6 semanas; sin pedidos en línea.', days: 3 },
    M: { fact: 'Abrió inscripciones del nuevo periodo; el formulario es un PDF.', days: 15 },
  };
  const w = map[k];
  return w ? { fact: w.fact, date: date(-w.days), source: `https://noticia.ejemplo.invalid/${k.toLowerCase()}` } : null;
};

const companies: Company[] = seeds.map((s) => ({
  id: `co_${s.key}`,
  name: s.name,
  locality: s.locality,
  industry: s.industry,
  isChainOrFranchise: !!s.chain,
  websiteUrl: s.key === 'C' || s.key === 'L' ? null : `https://${s.key.toLowerCase()}-ejemplo.invalid`,
  websiteRenewedOn: s.renewedOn ?? null,
  websiteRenewedSource: s.renewedSource ?? null,
}));

const prospects: Prospect[] = seeds.map((s) => ({
  id: `pr_${s.key}`,
  companyId: `co_${s.key}`,
  summary: s.summary,
  summarySource: `https://${s.key.toLowerCase()}-ejemplo.invalid/acerca`,
  offerInterest: s.offer,
  fit: null,
  budgetSignal: null,
  exclusion: s.exclusion ?? null,
  createdAt: d(-s.createdAge, 9),
  whyNow: whyNowOf(s.key),
}));

const evidence: Evidence[] = seeds.flatMap((s) => {
  if (s.chain) return [];
  const k = s.key.toLowerCase();
  const at = d(-s.evidenceAge, 11);
  return [
    { id: `ev_${s.key}_1`, prospectId: `pr_${s.key}`, component: 'social_outdated' as const,
      fact: `Última publicación en Instagram observada con más de 6 meses de antigüedad.`,
      url: `https://social.ejemplo.invalid/${k}`, observedAt: at, competitorUrl: null },
    { id: `ev_${s.key}_2`, prospectId: `pr_${s.key}`, component: 'lower_visibility_vs_competitor' as const,
      fact: `En la búsqueda "${s.industry.toLowerCase()} ${s.locality.toLowerCase()}" aparece después del competidor local. Comparación del día; sin línea base histórica.`,
      url: `https://buscador.ejemplo.invalid/q?${k}`, observedAt: at, competitorUrl: `https://competidor-${k}.invalid` },
    { id: `ev_${s.key}_3`, prospectId: `pr_${s.key}`, component: 'competitor_better' as const,
      fact: `Competidor del mismo rubro publica semanalmente y tiene reserva o pedido en línea.`,
      url: `https://competidor-${k}.invalid`, observedAt: at, competitorUrl: `https://competidor-${k}.invalid` },
  ];
});

const contacts: Contact[] = seeds.flatMap((s) => {
  const k = s.key.toLowerCase();
  const list: Contact[] = [
    { id: `ct_${s.key}_1`, prospectId: `pr_${s.key}`, role: 'decisor', channel: 'email',
      value: `contacto@${k}-ejemplo.invalid`, verified: ['A', 'B', 'D', 'F', 'N', 'M'].includes(s.key), verifiedAt: ['A', 'B', 'D', 'F', 'N', 'M'].includes(s.key) ? d(-1, 16) : null,
      warmPath: s.key === 'A' ? '2 contactos en común en LinkedIn (Chiri)' : s.key === 'F' ? 'Cliente anterior de Chiri conoce a la dueña' : s.key === 'B' ? '1 contacto en común en LinkedIn' : null },
  ];
  if (['B', 'F', 'M', 'H'].includes(s.key)) {
    list.push({ id: `ct_${s.key}_2`, prospectId: `pr_${s.key}`, role: 'ejecutor', channel: 'linkedin',
      value: `linkedin.ejemplo.invalid/in/persona-${k}`, verified: s.key === 'F', verifiedAt: s.key === 'F' ? d(-2, 12) : null, warmPath: null });
  }
  return list;
});

const reviews: Review[] = [
  { id: 'rv_A', prospectId: 'pr_A', decision: 'approve_contact', reason: null, revisitOn: null, decidedBy: 'adri', decidedAt: d(-2, 17) },
  { id: 'rv_B', prospectId: 'pr_B', decision: 'approve_contact', reason: null, revisitOn: null, decidedBy: 'adri', decidedAt: d(-9, 15) },
  { id: 'rv_F', prospectId: 'pr_F', decision: 'approve_contact', reason: null, revisitOn: null, decidedBy: 'adri', decidedAt: d(-14, 11) },
  { id: 'rv_M', prospectId: 'pr_M', decision: 'approve_contact', reason: null, revisitOn: null, decidedBy: 'adri', decidedAt: d(-25, 11) },
  { id: 'rv_N', prospectId: 'pr_N', decision: 'approve_contact', reason: null, revisitOn: null, decidedBy: 'adri', decidedAt: d(-40, 11) },
  { id: 'rv_E', prospectId: 'pr_E', decision: 'maybe', reason: 'Evidencia vieja; revisar si el problema persiste.', revisitOn: date(5), decidedBy: 'adri', decidedAt: d(-6, 10) },
  { id: 'rv_I', prospectId: 'pr_I', decision: 'discard', reason: 'Cadena: marketing centralizado.', revisitOn: null, decidedBy: 'adri', decidedAt: d(-5, 10) },
  { id: 'rv_J', prospectId: 'pr_J', decision: 'discard', reason: 'Web renovada hace 18 días (fuente con fecha).', revisitOn: null, decidedBy: 'adri', decidedAt: d(-4, 10) },
];

const stageOf: Record<string, Stage> = { A: 'new_lead', B: 'contacted', F: 'qualified', M: 'proposal_sent', N: 'closed', H: 'new_lead' };
const opportunities: Opportunity[] = Object.entries(stageOf).map(([k, stage]) => ({
  id: `op_${k}`, prospectId: `pr_${k}`, stage, source: 'ghl', updatedAt: d(k === 'N' ? -3 : -1, 14),
}));

const payments: PaymentVerification[] = [
  { opportunityId: 'op_N', type: 'project_50pct', contractSigned: true, depositVerified: false, verifiedAt: null,
    amountContracted: 2850, depositReceived: null, balancePending: null, deliveredAt: null, balanceVerifiedAt: null, balanceReceived: null },
];

const sentFirstB = d(-7, 9); // B: primer contacto enviado hace 7 días
const sentFirstF = d(-12, 9); // F: hace 12 días
const sentFirstM = d(-24, 9); // M: hace 24 días, respondió

const emailBody = (name: string) =>
  `Hola,\n\nVimos ${name} y notamos algo: el producto se ve mejor en persona que en línea. Hoy, quien busca en la zona encuentra primero a otros.\n\nEn Sparked leemos los datos antes de proponer. Nuestra web muestra cómo trabajamos: sparkedreactions.com.\n\n¿Te va una llamada de 15 minutos esta semana?\n\n[Firma]`;

const drafts: Draft[] = [
  { id: 'dr_A_1', prospectId: 'pr_A', kind: 'first_contact', followupDay: null, channel: 'email', subject: 'Una idea para Negocio de ejemplo A', body: emailBody('Negocio de ejemplo A'), status: 'draft', approvedAt: null, sentAt: null },
  { id: 'dr_B_1', prospectId: 'pr_B', kind: 'first_contact', followupDay: null, channel: 'email', subject: 'Citas en línea para Negocio de ejemplo B', body: emailBody('Negocio de ejemplo B'), status: 'sent', approvedAt: d(-8, 12), sentAt: sentFirstB },
  { id: 'dr_B_4', prospectId: 'pr_B', kind: 'followup', followupDay: 4, channel: 'email', subject: 'Re: Citas en línea para Negocio de ejemplo B', body: 'Hola,\n\nTe escribí la semana pasada. Si prefieres, te mando un resumen de una página en lugar de la llamada.\n\n[Firma]', status: 'sent', approvedAt: d(-3, 10), sentAt: d(-3, 11) },
  { id: 'dr_B_10', prospectId: 'pr_B', kind: 'followup', followupDay: 10, channel: 'email', subject: 'Re: Citas en línea para Negocio de ejemplo B', body: 'Hola,\n\nÚltimo intento por aquí. Si el momento no es ahora, sin problema.\n\n[Firma]', status: 'draft', approvedAt: null, sentAt: null },
  { id: 'dr_F_1', prospectId: 'pr_F', kind: 'first_contact', followupDay: null, channel: 'linkedin', subject: 'Mensaje de LinkedIn', body: 'Hola, vimos los listados de Negocio de ejemplo F y una idea concreta para que se vean como el producto. ¿Hablamos 15 minutos?', status: 'sent', approvedAt: d(-13, 12), sentAt: sentFirstF },
  { id: 'dr_F_4', prospectId: 'pr_F', kind: 'followup', followupDay: 4, channel: 'linkedin', subject: 'Mensaje de LinkedIn', body: 'Hola de nuevo. Te dejo nuestra web por si quieres ver cómo trabajamos: sparkedreactions.com', status: 'sent', approvedAt: d(-8, 12), sentAt: d(-8, 13) },
  { id: 'dr_F_10', prospectId: 'pr_F', kind: 'followup', followupDay: 10, channel: 'linkedin', subject: 'Mensaje de LinkedIn', body: 'Gracias por responder. Te propongo jueves o viernes a las 10 a. m. ET.', status: 'approved', approvedAt: d(-1, 9), sentAt: null },
  { id: 'dr_M_1', prospectId: 'pr_M', kind: 'first_contact', followupDay: null, channel: 'email', subject: 'Inscripción en línea para Negocio de ejemplo M', body: emailBody('Negocio de ejemplo M'), status: 'sent', approvedAt: d(-25, 12), sentAt: sentFirstM },
  { id: 'dr_H_1', prospectId: 'pr_H', kind: 'first_contact', followupDay: null, channel: 'email', subject: 'Negocio de ejemplo H y su web de 2019', body: emailBody('Negocio de ejemplo H'), status: 'draft', approvedAt: null, sentAt: null },
];

const followups: Followup[] = [
  // B: enviado hace 7 días → día 4 (hace 3), día 10 (en 3), día 20 (en 13)
  { id: 'fu_B_4', prospectId: 'pr_B', day: 4, dueOn: date(-3), stopped: false, stopReason: null, draftId: 'dr_B_4' },
  { id: 'fu_B_10', prospectId: 'pr_B', day: 10, dueOn: date(3), stopped: false, stopReason: null, draftId: 'dr_B_10' },
  { id: 'fu_B_20', prospectId: 'pr_B', day: 20, dueOn: date(13), stopped: false, stopReason: null, draftId: null },
  // F: enviado hace 12 días → día 4 (hace 8), día 10 (hace 2, toca hoy), día 20 (en 8)
  { id: 'fu_F_4', prospectId: 'pr_F', day: 4, dueOn: date(-8), stopped: false, stopReason: null, draftId: 'dr_F_4' },
  { id: 'fu_F_10', prospectId: 'pr_F', day: 10, dueOn: date(-2), stopped: false, stopReason: null, draftId: 'dr_F_10' },
  { id: 'fu_F_20', prospectId: 'pr_F', day: 20, dueOn: date(8), stopped: false, stopReason: null, draftId: null },
  // M: respondió el día 3 → secuencia detenida
  { id: 'fu_M_4', prospectId: 'pr_M', day: 4, dueOn: date(-20), stopped: true, stopReason: 'replied', draftId: null },
  { id: 'fu_M_10', prospectId: 'pr_M', day: 10, dueOn: date(-14), stopped: true, stopReason: 'replied', draftId: null },
  { id: 'fu_M_20', prospectId: 'pr_M', day: 20, dueOn: date(-4), stopped: true, stopReason: 'replied', draftId: null },
];

const fits: FitAssessment[] = [
  { id: 'ft_A', prospectId: 'pr_A', fit: 'buen_fit', services: ['core', 'cm'], budget: 'rango_core', note: 'Menú y reservas en línea: caso claro para Core.', decidedBy: 'adri', decidedAt: d(-2, 16) },
  { id: 'ft_F', prospectId: 'pr_F', fit: 'buen_fit', services: ['plus'], budget: 'rango_plus', note: null, decidedBy: 'adri', decidedAt: d(-14, 10) },
];

const stepsFor = (pid: string, done: number, running: boolean, notes: Partial<Record<AgentStep['key'], string>>, base: number): AgentStep[] => {
  const keys: AgentStep['key'][] = ['best_contact', 'warm_paths', 'brief', 'draft_email', 'save_gmail', 'update_pipeline', 'schedule_followups'];
  return keys.map((key, i) => ({
    prospectId: pid, key,
    status: i < done ? 'done' : running && i === done ? 'running' : 'pending',
    note: i <= done ? notes[key] ?? null : null,
    at: i < done ? d(base, 10 + i) : null,
  }));
};
const agentSteps: AgentStep[] = [
  ...stepsFor('pr_A', 3, true, { best_contact: 'contacto@a-ejemplo.invalid · decisor', warm_paths: '2 contactos en común en LinkedIn (Chiri)', brief: 'Ángulo: la terraza nueva se ve mejor en persona que en línea; un competidor publica menú y reservas.', draft_email: 'Redactando en formato 3, nivel cotidiano…' }, -1),
  ...stepsFor('pr_B', 7, false, { best_contact: 'contacto@b-ejemplo.invalid · decisor', warm_paths: '1 contacto en común en LinkedIn', brief: 'Ángulo: citas en línea para dos sedes.', draft_email: 'Borrador listo', save_gmail: 'Guardado en Gmail, destinatario en blanco', update_pipeline: 'New Lead → Contacted', schedule_followups: 'Días 4, 10 y 20 programados' }, -8),
  ...stepsFor('pr_F', 7, false, { best_contact: 'LinkedIn · ejecutora', warm_paths: 'Intro posible vía cliente anterior', brief: 'Ángulo: listados en video.', draft_email: 'Borrador listo', save_gmail: 'Mensaje LinkedIn preparado', update_pipeline: 'New Lead → Contacted', schedule_followups: 'Días 4, 10 y 20 programados' }, -13),
  ...stepsFor('pr_M', 7, false, { best_contact: 'contacto@m-ejemplo.invalid', warm_paths: 'Sin camino cálido', brief: 'Ángulo: inscripción en línea.', draft_email: 'Borrador listo', save_gmail: 'Guardado en Gmail', update_pipeline: 'New Lead → Contacted', schedule_followups: 'Secuencia detenida: respondió' }, -25),
  ...stepsFor('pr_N', 7, false, { best_contact: 'contacto@n-ejemplo.invalid', warm_paths: 'Sin camino cálido', brief: 'Ángulo: pedidos para eventos.', draft_email: 'Borrador listo', save_gmail: 'Guardado en Gmail', update_pipeline: 'Closed', schedule_followups: 'No aplica' }, -40),
];

const audit: AuditEvent[] = [
  { id: 'au_1', entity: 'prospect', entityId: 'pr_A', action: 'Ficha creada y enriquecida', by: 'maria', at: d(-3, 9) },
  { id: 'au_2', entity: 'evidence', entityId: 'ev_A_2', action: 'Evidencia observada (3 componentes)', by: 'maria', at: d(-2, 11) },
  { id: 'au_2b', entity: 'fit', entityId: 'ft_A', action: 'Fit: buen fit · Core, CM · presupuesto rango Core', by: 'adri', at: d(-2, 16) },
  { id: 'au_3', entity: 'review', entityId: 'rv_A', action: 'Contacto aprobado', by: 'adri', at: d(-2, 17) },
  { id: 'au_4', entity: 'draft', entityId: 'dr_A_1', action: 'Borrador de primer contacto creado', by: 'maria', at: d(-1, 10) },
  { id: 'au_5', entity: 'prospect', entityId: 'pr_B', action: 'Ficha creada y enriquecida', by: 'maria', at: d(-12, 9) },
  { id: 'au_6', entity: 'review', entityId: 'rv_B', action: 'Contacto aprobado', by: 'adri', at: d(-9, 15) },
  { id: 'au_7', entity: 'draft', entityId: 'dr_B_1', action: 'Borrador aprobado', by: 'adri', at: d(-8, 12) },
  { id: 'au_8', entity: 'draft', entityId: 'dr_B_1', action: 'Enviado por Adri', by: 'adri', at: sentFirstB },
  { id: 'au_9', entity: 'review', entityId: 'rv_I', action: 'Descartado: cadena', by: 'adri', at: d(-5, 10) },
  { id: 'au_10', entity: 'review', entityId: 'rv_E', action: 'Maybe: volver el ' + date(5), by: 'adri', at: d(-6, 10) },
  { id: 'au_11', entity: 'followup', entityId: 'fu_M_4', action: 'Secuencia detenida: respondió', by: 'maria', at: d(-21, 8) },
  { id: 'au_12', entity: 'payment', entityId: 'op_N', action: 'Contrato firmado registrado; depósito pendiente de verificar', by: 'chiri', at: d(-3, 14) },
];

export const fixtures: Dataset = {
  companies, prospects, evidence, contacts, reviews, opportunities, payments, drafts, followups, fits, agentSteps, audit,
  meta: { updatedAt: d(0, 14), source: 'Fixtures locales de la demo (ficticios)' },
};
