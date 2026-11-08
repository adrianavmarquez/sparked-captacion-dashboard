/**
 * Id visto en una revisión anterior del conector (7 nov 2026).
 * No es configuración activa: el adaptador solo usa GHL_PIPELINE_ID
 * y confirma el id contra la respuesta en vivo de GHL.
 */
export const UNVERIFIED_PIPELINE_CANDIDATE = {
  id: 'QhvlUSfH1yBG6fL7f7Gx',
  label: 'Marketing Pipeline',
  observedOn: '2026-11-07',
  trust: 'unverified',
} as const;

export const STAGE_NAME_TO_KEY = {
  'new lead': 'new_lead',
  contacted: 'contacted',
  qualified: 'qualified',
  'proposal sent': 'proposal_sent',
  negotiation: 'negotiation',
  closed: 'closed',
} as const;
