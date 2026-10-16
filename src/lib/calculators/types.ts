/**
 * Calculator computation layer — shared types and input helpers.
 *
 * The definitions in `src/data/calculators/definitions.json` describe the UI:
 * labels, defaults, units, formulas, worked examples and limitations. This
 * layer performs the arithmetic. Every function returns numbers only; the React
 * island formats them with the Indian-formatting helpers in `src/lib/format.ts`.
 *
 * Design rules, consistent with the rest of the finance library:
 *   - Never return a silent zero where a quantity is undefined; return `null`
 *     and add a warning explaining why.
 *   - Every non-obvious number carries at least one assumption or warning.
 *   - Illustrative examples use explicit, round assumptions.
 */

export type InputValue = number | string | boolean;

export interface CalcOutput {
  label: string;
  /** Raw numeric value, or a pre-formatted string for non-numeric results. */
  value: number | string | null;
  kind?: 'currency' | 'percent' | 'number' | 'years' | 'text' | 'multiple';
  note?: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'caution';
}

export interface CalcResult {
  outputs: CalcOutput[];
  warnings: string[];
  assumptions: string[];
  /** Optional secondary table, rendered as rows of label/value pairs. */
  steps?: { label: string; value: string }[];
}

export type InputRecord = Record<string, InputValue>;
export type CalcFn = (v: InputRecord) => CalcResult;

/* ------------------------------------------------------------------ helpers */

export function n(v: InputRecord, key: string, fallback = 0): number {
  const raw = v[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function s(v: InputRecord, key: string, fallback = ''): string {
  const raw = v[key];
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (typeof raw === 'boolean') return raw ? 'true' : 'false';
  return fallback;
}

export function b(v: InputRecord, key: string, fallback = false): boolean {
  const raw = v[key];
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') return raw === 'true' || raw === '1' || raw === 'yes';
  if (typeof raw === 'number') return raw !== 0;
  return fallback;
}

/** Percent inputs are entered as whole numbers (12 means 12%). */
export function pct(v: InputRecord, key: string, fallback = 0): number {
  return n(v, key, fallback) / 100;
}

export function isoDate(v: InputRecord, key: string): Date | null {
  const raw = s(v, key, '');
  if (!raw) return null;
  const parsed = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function possibilities(v: InputRecord, prefix: string, limit = 8): { date: Date; amount: number }[] {
  const flows: { date: Date; amount: number }[] = [];
  for (let i = 1; i <= limit; i += 1) {
    const date = isoDate(v, `${prefix}${i}`);
    const amount = n(v, `amount${i}`, Number.NaN);
    if (date && Number.isFinite(amount) && amount !== 0) flows.push({ date, amount });
  }
  return flows;
}

export function out(
  label: string,
  value: number | string | null,
  kind: CalcOutput['kind'] = 'number',
  extra: Omit<CalcOutput, 'label' | 'value' | 'kind'> = {},
): CalcOutput {
  return { label, value, kind, ...extra };
}

export function res(
  outputs: CalcOutput[],
  warnings: string[] = [],
  assumptions: string[] = [],
  steps?: { label: string; value: string }[],
): CalcResult {
  const base: CalcResult = { outputs, warnings, assumptions };
  if (steps && steps.length > 0) base.steps = steps;
  return base;
}

/** Round to a sane number of decimals without pretending to false precision. */
export function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return Number.NaN;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
