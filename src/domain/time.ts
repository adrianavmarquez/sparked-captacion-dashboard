import { DAY_MS, TIME_ZONE } from './constants';

export { DAY_MS };

/** Fecha civil YYYY-MM-DD en America/New_York, con DST. */
export function civilDateInEt(iso: string, timeZone = TIME_ZONE): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error('Fecha inválida.');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!y || !m || !day) throw new Error('Fecha inválida.');
  return `${y}-${m}-${day}`;
}

/** Suma días civiles a una fecha YYYY-MM-DD. No usa la zona del servidor. */
export function addCivilDays(isoDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error('Fecha civil inválida.');
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isIsoDateTime(value: string): boolean {
  const t = new Date(value).getTime();
  return Number.isFinite(t) && value.includes('T');
}
