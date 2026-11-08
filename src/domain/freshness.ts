import type { Freshness } from '../data/model';
import { DAY_MS, FRESH_DAYS, RECHECK_DAYS } from './constants';

/** Misma regla que la UI aprobada: 30×24 h y 7×24 h desde el instante observado. */
export function freshnessAt(observedAt: string, clock: Date): Freshness {
  const observed = new Date(observedAt).getTime();
  if (Number.isNaN(observed)) return 'obsoleta';
  const age = (clock.getTime() - observed) / DAY_MS;
  if (age > FRESH_DAYS) return 'obsoleta';
  if (age > RECHECK_DAYS) return 'revalidar';
  return 'fresca';
}

export function worstFreshnessAt(list: { observedAt: string }[], clock: Date): Freshness | 'sin_evidencia' {
  if (list.length === 0) return 'sin_evidencia';
  const order: Freshness[] = ['fresca', 'revalidar', 'obsoleta'];
  return list.map((e) => freshnessAt(e.observedAt, clock)).sort((a, b) => order.indexOf(b) - order.indexOf(a))[0];
}
