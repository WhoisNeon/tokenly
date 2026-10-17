const UNITS = [
  { limit: 1e9, suffix: 'B' },
  { limit: 1e6, suffix: 'M' },
  { limit: 1e3, suffix: 'K' },
];

/** 189562393 -> "189.6M". Keeps three significant digits so columns stay narrow. */
export function formatTokens(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  for (const { limit, suffix } of UNITS) {
    if (Math.abs(value) >= limit) {
      const scaled = value / limit;
      return `${scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1)}${suffix}`;
    }
  }
  return String(value);
}

export function formatCost(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0.00';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatExact(value: number): string {
  return value.toLocaleString('en-US');
}

/** `2026-10-14` -> `Oct 14`, parsed as UTC so the server timezone cannot shift the day. */
export function formatShortDate(period: string): string {
  const d = parsePeriod(period);
  if (!d) return period;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** `2026-10` -> `Oct 2026`. */
export function formatMonth(period: string): string {
  const d = parsePeriod(period);
  if (!d) return period;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function parsePeriod(period: string): Date | null {
  const iso = /^\d{4}-\d{2}$/.test(period) ? `${period}-01T00:00:00Z` : `${period}T00:00:00Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}