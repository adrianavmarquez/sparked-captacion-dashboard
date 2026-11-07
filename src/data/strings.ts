/**
 * Textos de la interfaz. Español por defecto [PROPUESTO]; variante de español [PENDIENTE].
 * Para inglés: duplicar este objeto como `en` y cambiar `strings`.
 * Microcopy = propuesto, no aprobado como voz final.
 */
export const es = {
  app: { name: 'Sparked Reactions', area: 'Captación', demoBanner: 'Demo · datos de ejemplo · no envía nada ·', tz: 'ET', logoSlot: 'logo oficial aquí', skip: 'Ir al contenido' },
  nav: { hoy: 'Hoy', prospectos: 'Prospectos', pipeline: 'Pipeline', seguimientos: 'Seguimientos', borradores: 'Borradores', criterios: 'Criterios', ingresos: 'Ingresos' },
  demo: { label: 'Estado de demo', normal: 'Normal', loading: 'Cargando', empty: 'Vacío', error: 'Error', forbidden: 'Sin permiso' },
  common: {
    loading: 'Leyendo datos…', retry: 'Reintentar', open: 'Abrir', back: 'Volver', source: 'Fuente', updated: 'Actualizado', verified: 'Verificado', unverified: 'No verificado',
    pending: 'Por definir', integrationPending: 'Integración pendiente', readOnly: 'Solo lectura', local: 'Solo local', saving: 'Guardando…', of: 'de', page: 'Página', prev: 'Anterior', next: 'Siguiente', results: 'resultados', all: 'Todas', none: 'Ninguna', clear: 'Limpiar filtros', search: 'Buscar',
    level: { confirmado: 'Confirmado', propuesto: 'Propuesto', pendiente: 'Pendiente', operativa: 'Norma operativa' },
  },
  states: {
    errorTitle: 'No pudimos leer los datos', errorBody: 'La fuente no respondió. Nada se perdió: vuelve a intentar.',
    forbiddenTitle: 'Sin permiso para ver esto', forbiddenBody: 'Esta cuenta no tiene acceso a la sección. Pide acceso a Adri.',
    emptyTitle: 'Nada por aquí todavía', emptyBody: 'Cuando María cargue fichas, aparecerán en esta lista.',
    noResultsTitle: 'Sin resultados con esos filtros', noResultsBody: 'Prueba con menos filtros o otra búsqueda.',
    noEvidence: 'Sin evidencia registrada', noEvidenceBody: 'La señal necesita tres componentes con URL y fecha. Hasta entonces, no se contacta.',
    notFound: 'No encontramos esa ficha',
  },
  freshness: { fresca: 'Fresca', revalidar: 'Revalidar', obsoleta: 'Obsoleta', sin_evidencia: 'Sin evidencia' },
  reviewState: { pending: 'Por revisar', approved: 'Contacto aprobado', maybe: 'Maybe', discarded: 'Descartado' },
  decision: { approve_contact: 'Aprobar contacto', maybe: 'Maybe', discard: 'Descartar' },
  offer: { diagnostico: 'Diagnóstico', core: 'Core', plus: 'Plus', cm: 'CM', none: 'Sin definir' },
  exclusion: { chain: 'Cadena', franchise: 'Franquicia', recently_renewed: 'Web recién renovada', manual_review: 'Revisión manual', none: 'Sin exclusión' },
  evidence: { social_outdated: 'Presencia social desactualizada', lower_visibility_vs_competitor: 'Menor visibilidad observable frente al competidor', competitor_better: 'Competidor local con mejor presencia', observed: 'Observado', competitor: 'Competidor',
    gapNote: 'Es una brecha observada hoy, no dinero perdido demostrado.' },
  stage: { new_lead: 'New Lead', contacted: 'Contacted', qualified: 'Qualified', proposal_sent: 'Proposal Sent', negotiation: 'Negotiation', closed: 'Closed' },
  stageCond: {
    new_lead: 'Fit y contacto listo', contacted: 'Envío efectivo', qualified: 'Encaja + confirmó interés', proposal_sent: 'Propuesta enviada', negotiation: 'Condiciones en discusión', closed: 'Contrato firmado + 50% o mes adelantado',
  },
  draftStatus: { draft: 'Borrador', approved: 'Aprobado por Adri', sent: 'Enviado' },
  channel: { email: 'Email', linkedin: 'LinkedIn' },
  role: { decisor: 'Decisor', ejecutor: 'Ejecutor', otro: 'Otro' },
  hoy: {
    title: 'Hoy', sub: 'Lo que pide una decisión tuya.', goalTitle: 'Meta: 10 webs', goalWindow: '7 nov 2026 a 7 feb 2027 (ET)', goalEmpty: 'Aún no hay ventas verificadas', goalEmptyBody: 'Solo cuenta firma + depósito verificados.', goalSigned: 'firmado, depósito en verificación',
    toReview: 'Fichas por revisar', toApprove: 'Borradores por aprobar', next: 'Siguiente', seeN: 'Ver las', dueFollowups: 'Seguimientos que tocan', revalidate: 'Evidencia por revalidar', capacity: 'Capacidad web', capacityBody: 'Webs en producción: Closed con anticipo recibido y sin entregar. Máximo 4. CM no suma.', capacityOne: 'web activa de 3', capacityMany: 'webs activas de 3',
    seeAll: 'Ver todo', nothingToday: 'Nada pendiente en este bloque.',
  },
  prospectos: {
    title: 'Prospectos', sub: 'María construye las fichas. Tú decides.', searchPh: 'Buscar negocio, rubro o localidad', fOffer: 'Oferta', fState: 'Revisión', fLocality: 'Localidad', fFresh: 'Evidencia', fExcl: 'Exclusión',
    cols: { name: 'Negocio', industry: 'Rubro', locality: 'Localidad', offer: 'Oferta', evidence: 'Evidencia', state: 'Revisión', contact: 'Contacto', created: 'Creado' },
  },
  ficha: {
    summary: 'Resumen', signal: 'Señal de oportunidad', contact: 'Mejor contacto y canal', fit: 'Fit y presupuesto', fitBody: 'No se infiere. Lo define Adri.', decision: 'Tu decisión', history: 'Historial', exclusion: 'Exclusión',
    reasonLabel: 'Razón (obligatoria)', revisitLabel: 'Volver el (obligatorio)', save: 'Guardar decisión', saved: 'Decisión guardada.', decided: 'Decidido por Adri el',
    renewedOn: 'Web renovada el', renewedNoDate: 'Fecha de renovación dudosa: revisión manual, no descarte automático.', pipeline: 'Etapa en GHL',
    threeSteps: 'Aprobar contacto, aprobar borrador y enviar son tres pasos separados.',
    fitTitle: 'Fit y presupuesto', fitSub: 'Lo decides tú; nada se infiere.', fitLevel: 'Fit con nuestros servicios', fitServices: 'Qué le vendemos', fitBudget: 'Señal de presupuesto', fitNote: 'Nota (opcional)',
    fitSave: 'Guardar fit', fitSaved: 'Fit guardado.', fitCurrent: 'Última valoración',
  },
  fit: { buen_fit: 'Buen fit', fit_parcial: 'Fit parcial', no_fit: 'No es fit' },
  fitDesc: { buen_fit: 'Encaja con lo que hacemos y vale la pena contactar.', fit_parcial: 'Encaja en parte; definir alcance antes de proponer.', no_fit: 'No es cliente para nosotros ahora.' },
  budget: { sin_dato: 'Sin dato', bajo: 'Parece bajo (menos que Diagnóstico)', rango_core: 'Rango Core', rango_plus: 'Rango Plus', abierto: 'Abierto a conversar' },
  pipeline: { title: 'Pipeline', sub: 'Etapas del Marketing Pipeline en GHL. Arrastra una tarjeta para cambiarla de etapa.', readFrom: 'Etapas leídas de GHL el 7 nov 2026 · los movimientos se guardan aquí; sincronización con GHL pendiente', moved: 'Movido a', dragHint: 'Mantén pulsado y arrastra. Con teclado: flechas izquierda y derecha.', empty: 'Sin oportunidades en esta etapa', connect: 'Conectar GHL', cond: 'Condición de entrada', lossReasons: 'Ganado/perdido y razones: verificación técnica futura.' },
  seguimientos: { title: 'Seguimientos', sub: 'Días 4, 10 y 20 desde el envío real del primer contacto. Cada uno es un borrador que revisas.', due: 'Toca', overdue: 'Atrasado', upcoming: 'Próximo', stopped: 'Detenido', replied: 'respondió', opt_out: 'pidió baja', noDraft: 'Sin borrador aún', firstSent: 'Primer contacto:', day: 'Día' },
  borradores: { title: 'Borradores', sub: 'Nada sale sin ti. Guardado no es enviado.', approve: 'Aprobar borrador', send: 'Enviar', sendHint: 'Integración pendiente: el envío lo presiona una persona cuando Gmail/LinkedIn estén conectados.', preview: 'Previsualización', plain: 'Texto plano', proofNote: 'Única prueba citable: sparkedreactions.com. Sin casos, métricas ni resultados.', subject: 'Asunto', approvedOn: 'Aprobado el', sentOn: 'Enviado el' },
  criterios: { title: 'Criterios y configuración', sub: 'Reglas vigentes y su nivel. Solo lectura en la demo.' },
  ingresos: { title: 'Ingresos', sub: 'Lo que llega a Closed pasa a monto contratado. Tú marcas anticipo, entrega y saldo; lo demás se calcula solo.', body: 'Contratado es facturación, anticipo es caja: no se mezclan. Sin montos estimados ni pronósticos. Sin datos de tarjeta ni cuenta.', contracted: 'Monto contratado', deposit: 'Anticipo cobrado', balance: 'Saldo pendiente', payment: 'Pago verificado' },
};

export type Strings = typeof es;
export const strings: Strings = es;
