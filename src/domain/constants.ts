/** Reglas confirmadas. No son precios de lista ni credenciales. */
export const GOAL = {
  target: 10,
  windowStart: '2026-11-07',
  windowEnd: '2027-02-07',
  timeZone: 'America/New_York',
} as const;

/** Capacidad web aprobada. CM no se suma a estos números. */
export const WEB_CAPACITY = { initial: 3, max: 4 } as const;

/** Estimación de Adri, separada. No es un cupo combinado. */
export const CM_CAPACITY_ESTIMATE = 4;

export const FRESH_DAYS = 30;
export const RECHECK_DAYS = 7;
export const DAY_MS = 86_400_000;
export const FOLLOWUP_DAYS = [4, 10, 20] as const;
export const TIME_ZONE = 'America/New_York';
