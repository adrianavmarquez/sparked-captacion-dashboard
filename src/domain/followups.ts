import { FOLLOWUP_DAYS } from './constants';
import { addCivilDays, civilDateInEt } from './time';

export type FollowupDay = (typeof FOLLOWUP_DAYS)[number];
export type StopReason = 'replied' | 'opt_out';

export interface ScheduledFollowup {
  day: FollowupDay;
  dueOn: string;
}

/**
 * Días 4, 10 y 20 desde el día civil ET del primer envío real.
 * Sin timestamp de envío no hay fechas: no se usan la aprobación ni "hoy".
 */
export function scheduleFollowups(firstSentAt: string | null): ScheduledFollowup[] | { error: 'missing_sent_at' } {
  if (!firstSentAt) return { error: 'missing_sent_at' };
  const start = civilDateInEt(firstSentAt);
  return FOLLOWUP_DAYS.map((day) => ({ day, dueOn: addCivilDays(start, day) }));
}

export function stopSequence<T extends { stopped: boolean; stopReason: StopReason | null }>(rows: T[], reason: StopReason): T[] {
  return rows.map((row) => ({ ...row, stopped: true, stopReason: reason }));
}

/** Esta versión no envía. El tipo de retorno never evita un camino de envío. */
export function assertFollowupDoesNotSend(): never {
  throw new Error('Los seguimientos no se envían solos. Hace falta un envío aprobado por Adri, todavía deshabilitado.');
}
