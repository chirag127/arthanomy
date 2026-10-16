/**
 * Return mathematics.
 *
 * The single most common source of misleading financial claims is the
 * confusion of arithmetic mean with geometric mean, and of money-weighted
 * with time-weighted returns. Every function here states which quantity it
 * computes, and every function refuses to return a number for inputs where
 * the quantity is undefined rather than silently returning 0 or NaN.
 */

const MS_PER_DAY = 86_400_000;

export interface CashFlow {
  /** Cash-flow date. Sign convention: negative = money out of the investor's pocket. */
  date: Date;
  amount: number;
  label?: string;
}

export interface XirrResult {
  /** Annualised money-weighted return as a fraction, or null if none exists. */
  rate: number | null;
  converged: boolean;
  iterations: number;
  method: 'newton' | 'bisection' | 'none';
  /** True when the cash-flow pattern permits more than one real root. */
  multipleRootsPossible: boolean;
  /** Residual NPV at the returned rate; a large value means the answer is unreliable. */
  npvAtSolution: number | null;
  error?: string;
  warning?: string;
}

export const DAYS_IN_YEAR = 365;

/** Fractional years between two dates on a 365-day basis. */
export function yearsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_DAY / DAYS_IN_YEAR;
}

/**
 * Compound annual growth rate.
 *
 * Returns null when the quantity is undefined: a non-positive starting value,
 * a non-positive ending value (a total loss has no finite CAGR), or a
 * non-positive horizon. Returning null forces the caller to show "not
 * applicable" instead of an infinity or a zero.
 */
export function cagr(beginValue: number, endValue: number, years: number): number | null {
  if (!Number.isFinite(beginValue) || !Number.isFinite(endValue) || !Number.isFinite(years)) return null;
  if (beginValue <= 0 || endValue <= 0 || years <= 0) return null;
  return Math.pow(endValue / beginValue, 1 / years) - 1;
}

export function cagrFromDates(
  beginValue: number,
  endValue: number,
  from: Date,
  to: Date,
): number | null {
  return cagr(beginValue, endValue, yearsBetween(from, to));
}

/** Total (cumulative) return over the period, as a fraction. */
export function totalReturn(beginValue: number, endValue: number): number | null {
  if (!Number.isFinite(beginValue) || !Number.isFinite(endValue) || beginValue <= 0) return null;
  return endValue / beginValue - 1;
}

/**
 * Real (inflation-adjusted) return.
 *
 * r_real = (1 + r_nominal) / (1 + pi) - 1
 *
 * The subtraction r_nominal - pi is an approximation that becomes materially
 * wrong for high nominal rates or high inflation. This function uses the exact
 * form and additionally exposes the approximation so a comparison can be shown.
 */
export function realReturn(nominal: number, inflation: number): number | null {
  if (!Number.isFinite(nominal) || !Number.isFinite(inflation)) return null;
  if (1 + inflation === 0) return null;
  return (1 + nominal) / (1 + inflation) - 1;
}

export function realReturnApproximation(nominal: number, inflation: number): number {
  return nominal - inflation;
}

/** Effective annual rate from a nominal rate with m compounding periods per year. */
export function effectiveAnnualRate(nominal: number, periodsPerYear: number): number {
  if (periodsPerYear <= 0) return Number.NaN;
  return Math.pow(1 + nominal / periodsPerYear, periodsPerYear) - 1;
}

/** Nominal rate that produces a given effective annual rate. */
export function nominalFromEffective(effective: number, periodsPerYear: number): number {
  if (periodsPerYear <= 0) return Number.NaN;
  return periodsPerYear * (Math.pow(1 + effective, 1 / periodsPerYear) - 1);
}

/** Continuous-compounding rate corresponding to a discrete effective rate. */
export function continuousRate(effective: number): number {
  return Math.log(1 + effective);
}

/**
 * The rate at which a nominal return produces exactly zero real return.
 * For a nominal 12% bond, inflation of 12% destroys the entire real return;
 * this equals the nominal rate rather than the approximation 0%.
 */
export function breakEvenInflation(nominal: number): number {
  return nominal;
}

/** Years for a quantity growing at a constant rate to double. */
export function yearsToDouble(rate: number): number | null {
  if (rate <= 0) return null;
  return Math.log(2) / Math.log(1 + rate);
}

export function monthsToDouble(rate: number): number | null {
  const years = yearsToDouble(rate);
  return years === null ? null : years * 12;
}

/* --------------------------------------------------------------------------
   Irregular cash flows — XIRR
   -------------------------------------------------------------------------- */

/**
 * Count sign changes in an order-sorted cash-flow series. Descartes' rule of
 * signs bounds the number of positive real roots by the number of sign
 * changes, so more than one sign change means the XIRR may not be unique.
 */
function countSignChanges(amounts: number[]): number {
  const signs = amounts.filter((a) => a !== 0).map((a) => (a > 0 ? 1 : -1));
  let changes = 0;
  for (let i = 1; i < signs.length; i += 1) {
    if (signs[i] !== signs[i - 1]) changes += 1;
  }
  return changes;
}

function npvAt(rate: number, amounts: number[], yearFractions: number[]): number {
  let sum = 0;
  for (let i = 0; i < amounts.length; i += 1) {
    const a = amounts[i];
    const t = yearFractions[i];
    if (a === undefined || t === undefined) continue;
    sum += a / Math.pow(1 + rate, t);
  }
  return sum;
}

function npvDerivativeAt(rate: number, amounts: number[], yearFractions: number[]): number {
  let sum = 0;
  for (let i = 0; i < amounts.length; i += 1) {
    const a = amounts[i];
    const t = yearFractions[i];
    if (a === undefined || t === undefined) continue;
    if (t === 0) continue;
    sum -= (t * a) / Math.pow(1 + rate, t + 1);
  }
  return sum;
}

/** A rate grid wide enough to bracket any plausible Indian investment outcome. */
const BRACKET_GRID: number[] = [
  -0.999999, -0.99, -0.95, -0.9, -0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.15, -0.1, -0.05, -0.02,
  -0.01, 0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.12, 0.15, 0.18, 0.2, 0.25, 0.3,
  0.4, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 25, 50, 100, 500, 1000, 1e4, 1e6,
];

/**
 * XIRR — the annualised internal rate of return of a dated cash-flow series.
 *
 * Solves NPV(r) = Σ CF_i / (1 + r)^((d_i - d_0) / 365) = 0.
 *
 * Strategy: a damped Newton–Raphson from the caller's guess, verified by a
 * residual check, with a bracketed bisection fallback. If the bracket search
 * finds no sign change the function reports that no solution exists rather
 * than returning the last iterate — a failure mode that makes many widely
 * used spreadsheet approximations quietly wrong.
 */
export function xirr(cashflows: CashFlow[], options: { guess?: number; tolerance?: number; maxIterations?: number } = {}): XirrResult {
  const tolerance = options.tolerance ?? 1e-9;
  const maxIterations = options.maxIterations ?? 200;
  const guess = options.guess ?? 0.1;

  const base: XirrResult = {
    rate: null,
    converged: false,
    iterations: 0,
    method: 'none',
    multipleRootsPossible: false,
    npvAtSolution: null,
  };

  if (cashflows.length < 2) {
    return { ...base, error: 'XIRR requires at least two cash flows.' };
  }
  if (cashflows.some((cf) => !Number.isFinite(cf.amount))) {
    return { ...base, error: 'XIRR received a cash flow with a non-finite amount.' };
  }
  if (cashflows.some((cf) => Number.isNaN(cf.date.getTime()))) {
    return { ...base, error: 'XIRR received a cash flow with an invalid date.' };
  }

  const sorted = [...cashflows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const amounts = sorted.map((cf) => cf.amount);
  const first = sorted[0];
  if (!first) return { ...base, error: 'XIRR requires at least two cash flows.' };

  const startTime = first.date.getTime();
  const yearFractions = sorted.map((cf) => (cf.date.getTime() - startTime) / MS_PER_DAY / DAYS_IN_YEAR);

  const hasPositive = amounts.some((a) => a > 0);
  const hasNegative = amounts.some((a) => a < 0);
  if (!hasPositive || !hasNegative) {
    return {
      ...base,
      error: 'XIRR is undefined when every cash flow has the same sign: a return cannot be computed without both an outflow and an inflow.',
    };
  }

  const signChanges = countSignChanges(amounts);
  const multipleRootsPossible = signChanges > 1;

  // ---- Attempt 1: Newton–Raphson with damping -------------------------------
  let rate = guess;
  let iterations = 0;
  let newtonOk = false;
  for (let i = 0; i < maxIterations; i += 1) {
    iterations = i + 1;
    const f = npvAt(rate, amounts, yearFractions);
    if (Math.abs(f) < tolerance) {
      newtonOk = true;
      break;
    }
    const df = npvDerivativeAt(rate, amounts, yearFractions);
    if (!Number.isFinite(df) || df === 0) break;
    let step = f / df;
    // Damping: never jump below -1 + epsilon, never take an enormous step.
    if (!Number.isFinite(step)) break;
    step = Math.max(-0.5, Math.min(0.5, step));
    const next = rate - step;
    if (next <= -0.999999 || !Number.isFinite(next)) break;
    if (Math.abs(next - rate) < 1e-14) {
      rate = next;
      newtonOk = Math.abs(npvAt(rate, amounts, yearFractions)) < 1e-6;
      break;
    }
    rate = next;
  }

  if (newtonOk) {
    const warning = multipleRootsPossible
      ? 'The cash-flow pattern has more than one sign change, so more than one positive rate may satisfy the equation. Treat this figure as one solution, not the solution.'
      : undefined;
    return {
      rate,
      converged: true,
      iterations,
      method: 'newton',
      multipleRootsPossible,
      npvAtSolution: npvAt(rate, amounts, yearFractions),
      ...(warning === undefined ? {} : { warning }),
    };
  }

  // ---- Attempt 2: bracketed bisection --------------------------------------
  let lowRate: number | null = null;
  let highRate: number | null = null;
  let lowValue = 0;
  for (let i = 0; i < BRACKET_GRID.length - 1; i += 1) {
    const r1 = BRACKET_GRID[i];
    const r2 = BRACKET_GRID[i + 1];
    if (r1 === undefined || r2 === undefined) continue;
    const v1 = npvAt(r1, amounts, yearFractions);
    const v2 = npvAt(r2, amounts, yearFractions);
    if (!Number.isFinite(v1) || !Number.isFinite(v2)) continue;
    if (v1 === 0) {
      lowRate = r1;
      highRate = r1;
      lowValue = v1;
      break;
    }
    if (v1 * v2 < 0) {
      lowRate = r1;
      highRate = r2;
      lowValue = v1;
      break;
    }
  }

  if (lowRate === null || highRate === null) {
    return {
      ...base,
      iterations,
      multipleRootsPossible,
      error:
        'No rate in the range −99.9999% to 100,000,000% satisfies the cash-flow equation. This usually indicates a cash-flow sign error, a data error, or a holding period too short for an annualised rate to be meaningful.',
    };
  }

  if (lowRate === highRate) {
    return {
      rate: lowRate,
      converged: true,
      iterations,
      method: 'bisection',
      multipleRootsPossible,
      npvAtSolution: lowValue,
    };
  }

  let lo = lowRate;
  let hi = highRate;
  let mid = (lo + hi) / 2;
  for (let i = 0; i < 400; i += 1) {
    iterations += 1;
    mid = (lo + hi) / 2;
    const fMid = npvAt(mid, amounts, yearFractions);
    if (Math.abs(fMid) < tolerance || hi - lo < 1e-12) {
      const warning = multipleRootsPossible
        ? 'The cash-flow pattern has more than one sign change; other solutions may exist.'
        : undefined;
      return {
        rate: mid,
        converged: Math.abs(fMid) < 1e-5,
        iterations,
        method: 'bisection',
        multipleRootsPossible,
        npvAtSolution: fMid,
        ...(warning === undefined ? {} : { warning }),
      };
    }
    const fLo = npvAt(lo, amounts, yearFractions);
    if (fLo * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  return {
    rate: mid,
    converged: false,
    iterations,
    method: 'bisection',
    multipleRootsPossible,
    npvAtSolution: npvAt(mid, amounts, yearFractions),
    error: 'Bisection did not reach the requested tolerance within the iteration limit.',
  };
}

/**
 * Periodic IRR for equally spaced cash flows (annual, monthly, or any fixed
 * period). Returns the rate per period, not an annualised rate — a caller that
 * needs an annual figure must compound it explicitly.
 */
export function irr(
  cashflows: number[],
  options: { guess?: number; tolerance?: number; maxIterations?: number } = {},
): { rate: number | null; converged: boolean; iterations: number; error?: string } {
  const tolerance = options.tolerance ?? 1e-10;
  const maxIterations = options.maxIterations ?? 200;
  if (cashflows.length < 2) {
    return { rate: null, converged: false, iterations: 0, error: 'IRR requires at least two periods.' };
  }
  if (!cashflows.some((c) => c > 0) || !cashflows.some((c) => c < 0)) {
    return {
      rate: null,
      converged: false,
      iterations: 0,
      error: 'IRR is undefined when all cash flows have the same sign.',
    };
  }

  const npv = (r: number): number => {
    let sum = 0;
    for (let t = 0; t < cashflows.length; t += 1) {
      const c = cashflows[t];
      if (c === undefined) continue;
      sum += c / Math.pow(1 + r, t);
    }
    return sum;
  };
  const dnpv = (r: number): number => {
    let sum = 0;
    for (let t = 1; t < cashflows.length; t += 1) {
      const c = cashflows[t];
      if (c === undefined) continue;
      sum -= (t * c) / Math.pow(1 + r, t + 1);
    }
    return sum;
  };

  let rate = options.guess ?? 0.1;
  let iterations = 0;
  for (let i = 0; i < maxIterations; i += 1) {
    iterations = i + 1;
    const f = npv(rate);
    if (Math.abs(f) < tolerance) return { rate, converged: true, iterations };
    const df = dnpv(rate);
    if (!Number.isFinite(df) || df === 0) break;
    const next = rate - Math.max(-0.5, Math.min(0.5, f / df));
    if (!Number.isFinite(next) || next <= -0.999999) break;
    if (Math.abs(next - rate) < 1e-14) {
      return { rate: next, converged: Math.abs(npv(next)) < 1e-6, iterations };
    }
    rate = next;
  }

  // Bisection fallback over a wide bracket.
  const grid: number[] = [];
  for (let r = -0.9999; r < 0; r += 0.05) grid.push(r);
  for (let r = 0; r <= 2.0001; r += 0.001) grid.push(r);
  grid.push(5, 10, 25, 100, 1e3, 1e6);
  for (let i = 0; i < grid.length - 1; i += 1) {
    const r1 = grid[i];
    const r2 = grid[i + 1];
    if (r1 === undefined || r2 === undefined) continue;
    if (npv(r1) * npv(r2) < 0) {
      let lo = r1;
      let hi = r2;
      for (let j = 0; j < 300; j += 1) {
        iterations += 1;
        const mid = (lo + hi) / 2;
        const fMid = npv(mid);
        if (Math.abs(fMid) < tolerance || hi - lo < 1e-12) {
          return { rate: mid, converged: Math.abs(fMid) < 1e-5, iterations };
        }
        if (npv(lo) * fMid < 0) hi = mid;
        else lo = mid;
      }
    }
  }

  return { rate: null, converged: false, iterations, error: 'IRR did not converge; the cash-flow pattern may have no real internal rate of return.' };
}

/* --------------------------------------------------------------------------
   Regular-contribution and withdrawal engines
   -------------------------------------------------------------------------- */

export interface SipResult {
  futureValue: number;
  totalInvested: number;
  totalGain: number;
  /** Effective annualised return on the invested amount if it were a lump sum. */
  absoluteReturn: number | null;
  years: number;
  /** Month-by-month accumulation, for charting. */
  schedule: { month: number; invested: number; value: number }[];
}

/**
 * SIP future value.
 *
 * timing 'begin' reproduces the standard Indian SIP convention where the
 * instalment is debited at the start of each month. The difference between
 * 'begin' and 'end' over a long horizon is material, which is why the timing
 * assumption is an explicit argument rather than a hidden default.
 */
export function sipFutureValue(
  monthlyInvestment: number,
  annualRate: number,
  years: number,
  options: { timing?: 'begin' | 'end'; annualStepUpPercent?: number; maxMonths?: number } = {},
): SipResult {
  const timing = options.timing ?? 'begin';
  const stepUp = (options.annualStepUpPercent ?? 0) / 100;
  const months = Math.min(Math.round(years * 12), options.maxMonths ?? 12_000);
  const monthlyRate = annualRate / 12;

  let value = 0;
  let invested = 0;
  let instalment = monthlyInvestment;
  const schedule: { month: number; invested: number; value: number }[] = [];

  for (let m = 1; m <= months; m += 1) {
    if (timing === 'begin') value += instalment;
    value *= 1 + monthlyRate;
    if (timing === 'end') value += instalment;
    invested += instalment;
    if (m % 12 === 0 && stepUp > 0) instalment *= 1 + stepUp;
    schedule.push({ month: m, invested, value });
  }

  const totalGain = value - invested;
  return {
    futureValue: value,
    totalInvested: invested,
    totalGain,
    absoluteReturn: invested > 0 ? totalGain / invested : null,
    years: months / 12,
    schedule,
  };
}

/** Lump-sum future value with optional inflation-style annual escalation. */
export function lumpsumFutureValue(
  principal: number,
  annualRate: number,
  years: number,
  options: { compoundsPerYear?: number } = {},
): { futureValue: number; gain: number; multiple: number | null } {
  const m = options.compoundsPerYear ?? 1;
  const futureValue = principal * Math.pow(1 + annualRate / m, m * years);
  return {
    futureValue,
    gain: futureValue - principal,
    multiple: principal > 0 ? futureValue / principal : null,
  };
}

export interface SwpYearPoint {
  year: number;
  balanceStart: number;
  withdrawn: number;
  growth: number;
  balanceEnd: number;
}

export interface SwpResult {
  points: SwpYearPoint[];
  finalBalance: number;
  totalWithdrawn: number;
  depleted: boolean;
  /** Whole years until the corpus reaches zero, or null if it survives the horizon. */
  depletedInYears: number | null;
  warning?: string;
}

/**
 * Systematic withdrawal plan simulation, annual steps with monthly-equivalent
 * withdrawals applied as a mid-year approximation.
 *
 * This is a deterministic calculator, not a forecast: a single constant return
 * cannot express sequence-of-returns risk, which is the dominant real-world
 * risk in a withdrawal plan. The output carries that warning explicitly so a
 * reader is not misled by a smooth projection.
 */
export function simulateSwp(
  initialCorpus: number,
  annualWithdrawalRate: number,
  annualGrowthRate: number,
  years: number,
  options: { annualWithdrawalStepUp?: number; inflationEscalation?: number } = {},
): SwpResult {
  const escalation = (options.inflationEscalation ?? 0) / 100;
  let balance = initialCorpus;
  let withdrawal = initialCorpus * annualWithdrawalRate;
  let totalWithdrawn = 0;
  const points: SwpYearPoint[] = [];
  let depletedInYears: number | null = null;

  for (let y = 1; y <= years; y += 1) {
    if (balance <= 0) break;
    const start = balance;
    const available = Math.min(withdrawal, balance);
    const invested = balance - available;
    const growth = invested * annualGrowthRate;
    balance = invested + growth;
    totalWithdrawn += available;
    points.push({
      year: y,
      balanceStart: start,
      withdrawn: available,
      growth,
      balanceEnd: balance,
    });
    if (balance <= 0 && depletedInYears === null) {
      depletedInYears = y;
    }
    withdrawal *= 1 + escalation;
  }

  return {
    points,
    finalBalance: balance,
    totalWithdrawn,
    depleted: balance <= 0,
    depletedInYears,
    warning:
      'A constant assumed return understates sequence-of-returns risk. A plan that survives a smooth projection can still fail if the early years produce poor returns while withdrawals are being taken. Use the sequence-of-returns simulator for that question.',
  };
}

/* --------------------------------------------------------------------------
   Time-weighted returns — the money manager's number
   -------------------------------------------------------------------------- */

/**
 * Modified Dietz return for a period containing external cash flows.
 * Weights each flow by the fraction of the period it was held.
 */
export function modifiedDietz(
  startValue: number,
  endValue: number,
  flows: { date: Date; amount: number }[],
  periodStart: Date,
  periodEnd: Date,
): number | null {
  const totalDays = (periodEnd.getTime() - periodStart.getTime()) / MS_PER_DAY;
  if (totalDays <= 0) return null;
  const netFlows = flows.reduce((s, f) => s + f.amount, 0);
  const weighted = flows.reduce((s, f) => {
    const daysRemaining = (periodEnd.getTime() - f.date.getTime()) / MS_PER_DAY;
    return s + f.amount * (daysRemaining / totalDays);
  }, 0);
  const denominator = startValue + weighted;
  if (denominator === 0) return null;
  return (endValue - startValue - netFlows) / denominator;
}

/**
 * Time-weighted (geometric) return from a series of sub-periods that each
 * begin with a known value. This is the return an investor would have earned
 * with no timing decisions, and is the correct basis for comparing managers.
 */
export function timeWeightedReturn(subPeriodReturns: number[]): number | null {
  if (subPeriodReturns.length === 0) return null;
  let product = 1;
  for (const r of subPeriodReturns) {
    if (!Number.isFinite(r)) return null;
    product *= 1 + r;
  }
  return product - 1;
}

/** Geometric mean of periodic returns: the correct "average" for compounding. */
export function geometricMean(periodReturns: number[]): number | null {
  if (periodReturns.length === 0) return null;
  let product = 1;
  for (const r of periodReturns) {
    if (r <= -1) return null;
    product *= 1 + r;
  }
  return Math.pow(product, 1 / periodReturns.length) - 1;
}

/** Arithmetic mean — the correct expected value for a single period, but not a growth rate. */
export function arithmeticMean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * The variance drag between the arithmetic and geometric mean, approximately
 * σ²/2. This is why a volatile asset with a high average return can compound
 * to a lower terminal wealth than a stable asset with a lower average.
 */
export function volatilityDrag(volatility: number): number {
  return (volatility * volatility) / 2;
}

/* --------------------------------------------------------------------------
   Tax and cost adjustments to a return
   -------------------------------------------------------------------------- */

export interface ReturnAdjustmentInput {
  grossReturn: number;
  /** Total annual fees and expenses as a fraction, e.g. 0.012 for 1.2%. */
  annualFees?: number;
  /** Tax rate applied to the gross return each year, as a fraction. */
  annualTaxRate?: number;
  /** Inflation rate as a fraction. */
  inflation?: number;
}

export interface ReturnAdjustmentResult {
  gross: number;
  afterFees: number;
  afterTax: number;
  afterInflation: number;
  /** Effective tax rate actually borne, which differs from the statutory rate
      once fees and the sequence of deductions are taken into account. */
  effectiveTaxRateOnGross: number;
  costDrag: number;
}

/**
 * Apply fee, tax and inflation drag to a gross return.
 *
 * Ordering matters and is deliberate: fees reduce the return before tax is
 * computed, because most investment expenses are either deducted from the
 * fund's NAV (and therefore reduce the taxable base) or are not deductible at
 * all. Applying tax to the gross return overstates the tax cost of a
 * high-fee product and understates the effective tax cost of a low-fee one.
 */
export function adjustReturn(input: ReturnAdjustmentInput): ReturnAdjustmentResult {
  const { grossReturn, annualFees = 0, annualTaxRate = 0, inflation = 0 } = input;
  const afterFees = grossReturn - annualFees;
  const tax = Math.max(0, afterFees) * annualTaxRate;
  const afterTax = afterFees - tax;
  const afterInflation = realReturn(afterTax, inflation) ?? Number.NaN;
  return {
    gross: grossReturn,
    afterFees,
    afterTax,
    afterInflation,
    effectiveTaxRateOnGross: grossReturn !== 0 ? tax / grossReturn : 0,
    costDrag: annualFees,
  };
}

/** Opportunity cost of holding cash rather than investing it. */
export function opportunityCost(
  amount: number,
  alternativeReturn: number,
  years: number,
): { foregoneValue: number; finalValue: number } {
  const { futureValue } = lumpsumFutureValue(amount, alternativeReturn, years);
  return { foregoneValue: futureValue - amount, finalValue: futureValue };
}
