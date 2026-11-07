import { now, DAY_MS } from '../data/adapter';

const ET = 'America/New_York';

/** Fecha corta en hora del Este, con zona visible. */
export function fmtDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00-05:00` : iso);
  return new Intl.DateTimeFormat('es', { timeZone: ET, day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}
export function fmtDateShort(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00-05:00` : iso);
  return new Intl.DateTimeFormat('es', { timeZone: ET, day: 'numeric', month: 'short' }).format(d);
}
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const s = new Intl.DateTimeFormat('es', { timeZone: ET, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${s} ET`;
}
/** Diferencia en días (enteros) entre una fecha y el "hoy" de la demo. Positivo = futuro. */
export function daysFromToday(isoDate: string): number {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00-05:00`);
  const t = new Date(now().toISOString().slice(0, 10) + 'T12:00:00-05:00');
  return Math.round((d.getTime() - t.getTime()) / DAY_MS);
}
export function ageDays(iso: string): number {
  return Math.floor((now().getTime() - new Date(iso).getTime()) / DAY_MS);
}
export function fmtMoney(n: number | null): string {
  if (n === null) return 'Por definir';
  return `US$${n.toLocaleString('en-US')}`;
}
