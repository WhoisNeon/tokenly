const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const oneDecimalFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});
const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: 'UTC',
});
const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  timeZone: 'UTC',
});
const monthShortFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  timeZone: 'UTC',
});
const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const TOKEN_SERIES = Object.freeze([
  {
    key: 'inputTokens',
    label: 'Input',
    short: 'In',
    color: '#346b8d',
    description: 'Fresh prompt tokens',
  },
  {
    key: 'outputTokens',
    label: 'Output',
    short: 'Out',
    color: '#e9643f',
    description: 'Generated tokens',
  },
  {
    key: 'cacheReadTokens',
    label: 'Cache read',
    short: 'Read',
    color: '#2c7969',
    description: 'Prompt cache hits',
  },
  {
    key: 'cacheCreationTokens',
    label: 'Cache write',
    short: 'Write',
    color: '#94a934',
    description: 'Prompt cache writes',
  },
]);

export const MODEL_COLORS = Object.freeze([
  '#346b8d',
  '#e9643f',
  '#2c7969',
  '#94a934',
  '#c58d23',
  '#8a6e9c',
  '#5b7c99',
  '#b0533a',
]);

export const AGENT_COLORS = Object.freeze({
  claude: '#e9643f',
  codex: '#346b8d',
  opencode: '#2c7969',
  amp: '#c58d23',
  droid: '#8a6e9c',
  codebuff: '#94a934',
  hermes: '#5b7c99',
  pi: '#b0533a',
  goose: '#7d8f55',
  openclaw: '#557a6f',
  kilo: '#bd7b37',
  kimi: '#6a7897',
  qwen: '#647f55',
  copilot: '#6c6f8e',
  gemini: '#4e7ca1',
  antigravity: '#9a6b57',
  grok: '#48564e',
  zcode: '#7f6c49',
});

// The stylesheet owns the dark-theme swatches, so hand out a custom-property
// reference that falls back to the light hex when no override is defined.
export function agentColor(agent) {
  return `var(--agent-${agent}, ${AGENT_COLORS[agent] ?? '#7c887f'})`;
}

export function modelColor(index) {
  return MODEL_COLORS[index % MODEL_COLORS.length];
}

export function formatNumber(value) {
  return integerFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

export function formatCompactNumber(value) {
  const number = Number.isFinite(Number(value)) ? Number(value) : 0;
  if (Math.abs(number) < 1_000) {
    return Number.isInteger(number) ? String(number) : oneDecimalFormatter.format(number);
  }
  return compactFormatter.format(number);
}

export function formatPercent(part, whole, { decimals = 1 } = {}) {
  const total = Number(whole);
  const value = Number(part);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(value)) return '0%';
  const percent = (value / total) * 100;
  if (percent > 0 && percent < 0.1) return '<0.1%';
  if (percent >= 99.95) return '100%';
  return `${percent.toFixed(decimals).replace(/\.0$/, '')}%`;
}

export function formatMoney(value, { precise = false } = {}) {
  const number = Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  let decimals = 2;
  if (precise) {
    if (number > 0 && number < 0.01) decimals = 4;
    else if (number > 0 && number < 1) decimals = 3;
  } else if (number > 0 && number < 0.01) {
    decimals = 4;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number);
}

export function moneyParts(value) {
  const number = Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const decimals = number > 0 && number < 0.01 ? 4 : 2;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number);
  const [whole, fraction = '00'] = formatted.split('.');
  return { whole, fraction: `.${fraction}` };
}

export function formatPriceInput(value) {
  if (value === null || value === undefined || value === '') return '';
  if (!Number.isFinite(Number(value))) return '';
  return String(Number(value));
}

export function parsePeriod(period) {
  if (typeof period !== 'string') return null;
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(period);
  if (!match) return null;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3] ?? '1'), 12),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseIsoDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function periodLabel(period, report) {
  const date = parsePeriod(period);
  if (!date) {
    return { primary: String(period ?? '—'), secondary: '', short: String(period ?? '—'), full: String(period ?? '—'), weekday: '' };
  }
  if (report === 'monthly') {
    const month = monthFormatter.format(date);
    const year = String(date.getUTCFullYear());
    const shortMonth = monthShortFormatter.format(date);
    return {
      primary: month,
      secondary: year,
      short: `${shortMonth} ’${year.slice(-2)}`,
      full: `${month} ${year}`,
      weekday: '',
    };
  }
  const monthDay = shortDateFormatter.format(date);
  const weekday = weekdayFormatter.format(date);
  const year = String(date.getUTCFullYear());
  return {
    primary: monthDay,
    secondary: `${weekday} · ${year}`,
    short: monthDay,
    full: fullDateFormatter.format(date),
    weekday,
  };
}

export function rangeWindowLabel(range, report) {
  if (!range?.since || !range?.until) return 'All recorded time';
  const start = parseIsoDate(range.since);
  const end = parseIsoDate(range.until);
  if (!start || !end) return range.label ?? 'Selected range';

  if (report === 'monthly') {
    const startLabel = `${monthShortFormatter.format(start)} ${start.getUTCFullYear()}`;
    const endLabel = `${monthShortFormatter.format(end)} ${end.getUTCFullYear()}`;
    return startLabel === endLabel ? startLabel : `${startLabel} — ${endLabel}`;
  }

  const startLabel = shortDateFormatter.format(start);
  const endLabel = shortDateFormatter.format(end);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  if (sameYear) return `${startLabel} — ${endLabel}, ${end.getUTCFullYear()}`;
  return `${startLabel}, ${start.getUTCFullYear()} — ${endLabel}, ${end.getUTCFullYear()}`;
}

export function relativeTime(isoString, now = Date.now()) {
  if (!isoString) return 'not yet';
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return 'not yet';
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return dateTimeFormatter.format(date);
}

export function formatDuration(milliseconds) {
  const ms = Number(milliseconds);
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  return `${(ms / 1_000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function escapeAttribute(value) {
  return escapeHtml(value);
}

export function formatDateInput(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return dateTimeFormatter.format(date);
}
