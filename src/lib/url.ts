/**
 * URL helpers.
 *
 * Arthanomy is deployed as a GitHub Pages *project site* under /arthanomy, so
 * every internal link must be prefixed with the configured base path. Call
 * these helpers instead of hard-coding "/some/path".
 */

const RAW_BASE = import.meta.env.BASE_URL ?? '/';

/** Normalised base path without a trailing slash, '' for root deployments. */
export const base = RAW_BASE.endsWith('/') ? RAW_BASE.slice(0, -1) : RAW_BASE;

/** Build an internal URL honouring the deployment base path. */
export function href(path: string): string {
  if (!path) return base || '/';
  if (/^(https?:)?\/\//.test(path) || path.startsWith('mailto:') || path.startsWith('#')) {
    return path;
  }
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}${clean}`;
}

/** Article URL from a content id (e.g. "debt/bond-basics" -> /library/debt/bond-basics). */
export function articleHref(id: string): string {
  return href(`/library/${id.replace(/\/index$/, '')}`);
}

/** Canonical absolute URL for a site path (used for SEO metadata). */
export function absoluteUrl(path: string, site: URL | undefined): string {
  const pathname = href(path);
  return site ? new URL(pathname, site).href : pathname;
}

export function formatIndianDate(date: Date, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    ...opts,
  }).format(date);
}

export function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function pluralise(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}
