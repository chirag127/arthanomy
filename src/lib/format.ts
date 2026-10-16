/**
 * Formatting helpers.
 *
 * Every number a reader sees is formatted in Indian convention (lakh/crore
 * grouping, en-IN digit grouping) with an explicit unit. Financial software
 * that displays "1,000,000" to an Indian reader is communicating in the wrong
 * dialect, and one that displays a bare "20" where a percentage was meant is
 * actively dangerous. These helpers exist to make both mistakes impossible.
 */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const inrPaiseFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
});

/** ₹12,34,567 — Indian digit grouping. */
export function formatINR(value: number, options: { paise?: boolean } = {}): string {
  if (!Number.isFinite(value)) return '—';
  const fmt = options.paise ? inrPaiseFormatter : inrFormatter;
  return fmt.format(value);
}

/**
 * Compact Indian money: ₹8,500 · ₹4.25 L · ₹1.73 Cr · ₹2.4 T.
 * Used only where an exact figure would obscure the comparison.
 */
export function formatINRCompact(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${sign}₹${numberFormatter.format(abs / 1e12)} T`;
  if (abs >= 1e7) return `${sign}₹${numberFormatter.format(abs / 1e7)} Cr`;
  if (abs >= 1e5) return `${sign}₹${numberFormatter.format(abs / 1e5)} L`;
  if (abs >= 1e3) return `${sign}₹${integerFormatter.format(abs)}`;
  return `${sign}₹${numberFormatter.format(abs)}`;
}

/** 12,34,567 (no currency symbol). */
export function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(value);
}

/** 8.25% — percentages are always shown with a sign-free percent symbol. */
export function formatPercent(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return `${formatNumber(value, decimals)}%`;
}

/**
 * A return expressed as a fraction (0.0825) displayed as a percentage.
 * Signed, because for returns the sign carries the information.
 */
export function formatReturn(fraction: number, decimals = 2): string {
  if (!Number.isFinite(fraction)) return '—';
  const pct = fraction * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${formatNumber(pct, decimals)}%`;
}

/** Convert a fraction to a percent number for display in a chart axis. */
export function toPercent(fraction: number): number {
  return Number.isFinite(fraction) ? fraction * 100 : Number.NaN;
}

export function formatMultiple(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return `${formatNumber(value, decimals)}×`;
}

/** "8Y 4M" from a year fraction, used for durations and holding periods. */
export function formatDuration(years: number): string {
  if (!Number.isFinite(years) || years < 0) return '—';
  const wholeYears = Math.floor(years);
  const months = Math.round((years - wholeYears) * 12);
  if (months === 12) return `${wholeYears + 1}Y 0M`;
  if (wholeYears === 0) return `${months}M`;
  return `${wholeYears}Y ${months}M`;
}

export function formatCount(value: number, singular: string, plural?: string): string {
  const noun = value === 1 ? singular : (plural ?? `${singular}s`);
  return `${integerFormatter.format(value)} ${noun}`;
}

export function signedClass(value: number): string {
  if (!Number.isFinite(value)) return 'text-muted';
  if (value > 0) return 'text-gain';
  if (value < 0) return 'text-loss';
  return 'text-muted';
}

/**
 * Display a value that may be genuinely unavailable, as distinct from zero.
 * The distinction matters for financial data: an unrated instrument is not an
 * instrument rated zero, and an unknown yield is not a zero yield.
 */
export function formatOrUnavailable(
  value: number | null | undefined,
  formatter: (v: number) => string = (v) => formatNumber(v),
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Not available';
  return formatter(value);
}

/** ISO date in the site's canonical display form. */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

export function formatMonthYear(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

export function toISODate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Reading-time estimate from a word count, using a conservative 220 wpm. */
export function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 220));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
