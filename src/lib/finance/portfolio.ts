/**
 * Portfolio construction and analysis.
 *
 * The functions here are deliberately conservative about what they claim.
 * Optimisation on historical estimates is mathematically tidy and empirically
 * fragile; every optimiser therefore returns the input sensitivity alongside
 * the weights, and none of them return a single "optimal" portfolio without
 * also returning the assumptions that produced it.
 */

import { mean, stdev, correlation } from './statistics';

export interface PortfolioInput {
  names: string[];
  /** Weights as fractions summing to 1. */
  weights: number[];
  /** Expected annual returns as fractions. */
  expectedReturns: number[];
  /** Annual volatilities as fractions. */
  volatilities: number[];
  /** Correlation matrix, n × n. */
  correlations: number[][];
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validate weights against the only rule that matters: they must sum to 1 and
 * none may be negative in a long-only portfolio. Returns issues rather than
 * throwing so the UI can display them inline.
 */
export function validateWeights(weights: number[], tolerance = 0.0005): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (weights.length === 0) {
    issues.push({ field: 'weights', message: 'No allocation weights were supplied.', severity: 'error' });
    return issues;
  }
  if (weights.some((w) => !Number.isFinite(w))) {
    issues.push({ field: 'weights', message: 'A weight is not a finite number.', severity: 'error' });
    return issues;
  }
  if (weights.some((w) => w < -tolerance)) {
    issues.push({
      field: 'weights',
      message: 'A negative weight implies short-selling, which this model does not support.',
      severity: 'error',
    });
  }
  const total = weights.reduce((s, w) => s + w, 0);
  if (Math.abs(total - 1) > tolerance) {
    issues.push({
      field: 'weights',
      message: `Weights sum to ${(total * 100).toFixed(2)}% rather than 100%. Every result would be scaled incorrectly.`,
      severity: 'error',
    });
  }
  return issues;
}

export function portfolioExpectedReturn(weights: number[], expectedReturns: number[]): number | null {
  const n = Math.min(weights.length, expectedReturns.length);
  if (n === 0) return null;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const w = weights[i];
    const r = expectedReturns[i];
    if (w === undefined || r === undefined) continue;
    sum += w * r;
  }
  return sum;
}

/** Covariance matrix from volatilities and a correlation matrix. */
export function buildCovariance(volatilities: number[], correlations: number[][]): number[][] {
  const n = volatilities.length;
  const cov: number[][] = [];
  for (let i = 0; i < n; i += 1) {
    const row: number[] = [];
    for (let j = 0; j < n; j += 1) {
      const vi = volatilities[i] ?? 0;
      const vj = volatilities[j] ?? 0;
      const rho = correlations[i]?.[j] ?? (i === j ? 1 : 0);
      row.push(rho * vi * vj);
    }
    cov.push(row);
  }
  return cov;
}

export function portfolioVariance(weights: number[], covariance: number[][]): number | null {
  const n = Math.min(weights.length, covariance.length);
  if (n === 0) return null;
  let variance = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const wi = weights[i];
      const wj = weights[j];
      const c = covariance[i]?.[j];
      if (wi === undefined || wj === undefined || c === undefined) continue;
      variance += wi * wj * c;
    }
  }
  return variance;
}

export function portfolioVolatility(weights: number[], covariance: number[][]): number | null {
  const v = portfolioVariance(weights, covariance);
  return v === null ? null : Math.sqrt(Math.max(0, v));
}

/**
 * Weighted-average volatility of the components versus the portfolio's actual
 * volatility. Their ratio is the diversification ratio: at 1.0 there is no
 * diversification benefit at all, which happens whenever every correlation is 1.
 */
export function diversificationRatio(
  weights: number[],
  volatilities: number[],
  portfolioVol: number,
): number | null {
  if (portfolioVol <= 0) return null;
  let weighted = 0;
  for (let i = 0; i < weights.length; i += 1) {
    weighted += (weights[i] ?? 0) * (volatilities[i] ?? 0);
  }
  return weighted / portfolioVol;
}

/**
 * Weighted-average pairwise correlation. A useful single summary of whether a
 * portfolio is genuinely diversified — and one that spikes toward 1 in every
 * real crisis, which is exactly when diversification is most needed.
 */
export function averageCorrelation(correlations: number[][]): number | null {
  const n = correlations.length;
  if (n < 2) return null;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const rho = correlations[i]?.[j];
      if (rho === undefined) continue;
      sum += rho;
      count += 1;
    }
  }
  return count > 0 ? sum / count : null;
}

/** Herfindahl index of the allocation: 1 = single asset, 1/n = equal weight. */
export function concentrationHHI(weights: number[]): number {
  return weights.reduce((s, w) => s + (Number.isFinite(w) ? w * w : 0), 0);
}

/** Effective number of positions: 1 / HHI. */
export function effectivePositions(weights: number[]): number {
  const hhi = concentrationHHI(weights);
  return hhi > 0 ? 1 / hhi : 0;
}

/* ---------------------------- Rebalancing ---------------------------- */

export interface RebalanceInput {
  currentValues: number[];
  targetWeights: number[];
  /** Drift in percentage points that triggers rebalancing, e.g. 5 for ±5%. */
  toleranceBand: number;
  /** Cost of a round trip as a fraction, used to estimate the cost of trading. */
  transactionCostRate?: number;
  /** Tax rate applied to realised gains from the trades. */
  capitalGainsTaxRate?: number;
  /** Unrealised gain fraction per position, used to estimate the tax cost. */
  unrealisedGainFractions?: number[];
}

export interface RebalanceTrade {
  index: number;
  currentValue: number;
  currentWeight: number;
  targetValue: number;
  targetWeight: number;
  drift: number;
  tradeValue: number;
  action: 'buy' | 'sell' | 'hold';
  estimatedCost: number;
  estimatedTax: number;
}

export interface RebalanceResult {
  totalValue: number;
  trades: RebalanceTrade[];
  anyBreach: boolean;
  totalTurnover: number;
  totalCost: number;
  totalTax: number;
  /** The same rebalancing decision expressed as the cost of not rebalancing. */
  note: string;
}

/**
 * Compute the trades needed to restore target weights, flagging which position
 * breached its band so a decision can be made per position rather than on the
 * whole portfolio. Turnover, cost and tax are estimated because the *cost* of
 * rebalancing is the part that analysis usually omits.
 */
export function rebalance(input: RebalanceInput): RebalanceResult {
  const total = input.currentValues.reduce((s, v) => s + v, 0);
  const costRate = input.transactionCostRate ?? 0;
  const taxRate = input.capitalGainsTaxRate ?? 0;
  const trades: RebalanceTrade[] = [];
  let anyBreach = false;
  let turnover = 0;
  let cost = 0;
  let tax = 0;

  for (let i = 0; i < input.currentValues.length; i += 1) {
    const currentValue = input.currentValues[i] ?? 0;
    const targetWeight = input.targetWeights[i] ?? 0;
    const targetValue = total * targetWeight;
    const currentWeight = total > 0 ? currentValue / total : 0;
    const tradeValue = targetValue - currentValue;
    const drift = currentWeight - targetWeight;
    const breaches = Math.abs(drift) * 100 > input.toleranceBand;
    if (breaches) anyBreach = true;
    const cost_ = Math.abs(tradeValue) * costRate;
    const gainFraction = input.unrealisedGainFractions?.[i] ?? 0;
    const estimatedTax = tradeValue < 0 ? Math.abs(tradeValue) * gainFraction * taxRate : 0;
    turnover += Math.abs(tradeValue);
    cost += cost_;
    tax += estimatedTax;
    trades.push({
      index: i,
      currentValue,
      currentWeight,
      targetValue,
      targetWeight,
      drift,
      tradeValue,
      action: Math.abs(tradeValue) < total * 0.0001 ? 'hold' : tradeValue > 0 ? 'buy' : 'sell',
      estimatedCost: cost_,
      estimatedTax,
    });
  }

  return {
    totalValue: total,
    trades,
    anyBreach,
    totalTurnover: total > 0 ? turnover / total : 0,
    totalCost: cost,
    totalTax: tax,
    note:
      'Costs and taxes are estimates from the rates supplied, not tax advice. Rebalancing inside a tax-deferred account has no capital-gains cost; rebalancing a taxable account does, which is why the cheapest location for rebalancing is usually the one where it is free.',
  };
}

/** Value drifted weights from a starting allocation and a set of asset returns. */
export function driftedWeights(initialWeights: number[], assetReturns: number[]): number[] {
  const values = initialWeights.map((w, i) => w * (1 + (assetReturns[i] ?? 0)));
  const total = values.reduce((s, v) => s + v, 0);
  return total > 0 ? values.map((v) => v / total) : values;
}

/* ---------------------------- Optimisation ---------------------------- */

export interface OptimisationResult {
  weights: number[];
  expectedReturn: number;
  volatility: number;
  sharpe: number | null;
  method: string;
  warnings: string[];
}

/**
 * Minimum-variance weights by projected gradient descent with a simplex
 * projection. Implemented numerically rather than with a matrix inverse so that
 * it remains stable for near-singular covariance matrices — which real
 * correlation estimates frequently are.
 */
export function minimumVarianceWeights(
  covariance: number[][],
  expectedReturns: number[],
  riskFreeRate = 0,
  iterations = 20_000,
): OptimisationResult {
  const n = covariance.length;
  const warnings: string[] = [];
  let w = new Array<number>(n).fill(1 / Math.max(1, n));

  const grad = (weights: number[]): number[] => {
    const g = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i += 1) {
      let sum = 0;
      for (let j = 0; j < n; j += 1) {
        sum += (covariance[i]?.[j] ?? 0) * (weights[j] ?? 0);
      }
      g[i] = 2 * sum;
    }
    return g;
  };

  const objective = (weights: number[]): number => {
    let v = 0;
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        v += (weights[i] ?? 0) * (weights[j] ?? 0) * (covariance[i]?.[j] ?? 0);
      }
    }
    return v;
  };

  let step = 0.05;
  let best = objective(w);
  for (let iter = 0; iter < iterations; iter += 1) {
    const g = grad(w);
    const candidate = w.map((wi, i) => Math.max(0, wi - step * (g[i] ?? 0)));
    const total = candidate.reduce((s, v) => s + v, 0);
    if (total <= 0) break;
    const normalised = candidate.map((v) => v / total);
    const value = objective(normalised);
    if (value < best - 1e-14) {
      w = normalised;
      best = value;
      step *= 1.02;
    } else {
      step *= 0.5;
      if (step < 1e-12) break;
    }
  }

  const expected = portfolioExpectedReturn(w, expectedReturns) ?? Number.NaN;
  const vol = Math.sqrt(Math.max(0, objective(w)));
  if (w.some((wi) => wi < 1e-6) && w.every((wi) => wi > 1e-6)) {
    warnings.push('The optimiser produced weights very close to zero for at least one asset.');
  }
  warnings.push(
    'Minimum-variance weights are computed from the covariance matrix supplied. If that matrix came from a short or calm historical period, the weights are fitted to that period and are not forecasts.',
  );

  return {
    weights: w,
    expectedReturn: expected,
    volatility: vol,
    sharpe: vol > 0 ? (expected - riskFreeRate) / vol : null,
    method: 'Projected gradient descent on portfolio variance',
    warnings,
  };
}

/**
 * Equal-risk-contribution (risk parity) weights.
 *
 * Iterative: each asset's weight is scaled by the ratio of the target risk
 * contribution to its actual contribution. Genuine risk parity requires the
 * covariance matrix, because a low-volatility asset can still contribute
 * substantially to portfolio risk if it is highly correlated with everything
 * else — which is precisely the case that naive inverse-volatility weighting
 * gets wrong.
 */
export function riskParityWeights(
  covariance: number[][],
  iterations = 5_000,
  tolerance = 1e-10,
): OptimisationResult {
  const n = covariance.length;
  const warnings: string[] = [];
  let w = new Array<number>(n).fill(1 / Math.max(1, n));
  const target = 1 / Math.max(1, n);

  for (let iter = 0; iter < iterations; iter += 1) {
    const sigma = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i += 1) {
      let s = 0;
      for (let j = 0; j < n; j += 1) {
        s += (covariance[i]?.[j] ?? 0) * (w[j] ?? 0);
      }
      sigma[i] = (w[i] ?? 0) * s;
    }
    const total = sigma.reduce((s, v) => s + v, 0);
    if (total <= 0) break;
    const contributions = sigma.map((s) => s / total);
    let maxDeviation = 0;
    const next = w.map((wi, i) => {
      const c = contributions[i] ?? target;
      const scale = Math.sqrt(target / Math.max(c, 1e-12));
      const nw = wi * scale;
      maxDeviation = Math.max(maxDeviation, Math.abs(nw - wi));
      return nw;
    });
    const nextTotal = next.reduce((s, v) => s + v, 0);
    w = next.map((v) => v / nextTotal);
    if (maxDeviation < tolerance) break;
  }

  const vol = Math.sqrt(Math.max(0, portfolioVariance(w, covariance) ?? 0));
  warnings.push(
    'Risk parity equalises risk contributions, not returns. It makes no claim that any asset is attractively priced, and it will hold a great deal of whatever has recently been least volatile.',
  );

  return {
    weights: w,
    expectedReturn: Number.NaN,
    volatility: vol,
    sharpe: null,
    method: 'Iterative equal-risk-contribution',
    warnings,
  };
}

/**
 * Sampled efficient frontier.
 *
 * Rather than solving the quadratic program analytically, a large number of
 * random long-only portfolios are evaluated and the non-dominated ones are
 * retained. This is slower but has no failure mode on a singular covariance
 * matrix and makes the output honest: it is an *observed* set of portfolios, not
 * a theoretical maximum.
 */
export function sampledFrontier(
  covariance: number[][],
  expectedReturns: number[],
  samples = 20_000,
  seed = 4_242,
): { points: { expectedReturn: number; volatility: number; weights: number[] }[]; note: string } {
  const n = covariance.length;
  let state = seed;
  const rand = (): number => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };

  const points: { expectedReturn: number; volatility: number; weights: number[] }[] = [];
  const evaluate = (w: number[]) => {
    const er = portfolioExpectedReturn(w, expectedReturns);
    const vol = portfolioVolatility(w, covariance);
    if (er === null || vol === null) return;
    points.push({ expectedReturn: er, volatility: vol, weights: w });
  };

  // Always include the boundaries and the common benchmarks.
  for (let i = 0; i < n; i += 1) {
    const w = new Array<number>(n).fill(0);
    w[i] = 1;
    evaluate(w);
  }
  evaluate(new Array<number>(n).fill(1 / n));
  const minVar = minimumVarianceWeights(covariance, expectedReturns);
  evaluate(minVar.weights);

  for (let s = 0; s < samples; s += 1) {
    const raw = Array.from({ length: n }, () => rand());
    const total = raw.reduce((a, b) => a + b, 0);
    if (total <= 0) continue;
    evaluate(raw.map((v) => v / total));
  }

  const frontier = points.filter((p) =>
    !points.some((q) => q.volatility <= p.volatility && q.expectedReturn >= p.expectedReturn && (q.volatility < p.volatility || q.expectedReturn > p.expectedReturn)),
  );

  return {
    points: frontier.sort((a, b) => a.volatility - b.volatility),
    note:
      'The sampled frontier is bounded by the assets and the historical estimates supplied. It contains no asset class that was not entered, and it cannot discover an allocation to something outside the input set. Optimisation over historical estimates routinely produces allocations that would have been excellent in the past and are unreliable going forward.',
  };
}

/* ---------------------------- Goal planning ---------------------------- */

/**
 * Required monthly investment to reach a goal, solved numerically so that a
 * step-up contribution schedule or an uneven return assumption can be modelled
 * without a closed-form formula.
 */
export function requiredMonthlyInvestment(
  targetValue: number,
  initialValue: number,
  annualReturn: number,
  years: number,
  options: { annualStepUpPercent?: number; tolerance?: number } = {},
): { monthlyInvestment: number; totalInvested: number; totalGrowth: number; note: string } {
  const stepUp = options.annualStepUpPercent ?? 0;
  const tolerate = options.tolerance ?? 1;
  const months = Math.max(1, Math.round(years * 12));
  const monthlyRate = annualReturn / 12;

  const simulate = (monthly: number): { value: number; invested: number } => {
    let value = initialValue;
    let invested = initialValue;
    let contribution = monthly;
    for (let m = 1; m <= months; m += 1) {
      value = (value + contribution) * (1 + monthlyRate);
      invested += contribution;
      if (m % 12 === 0) contribution *= 1 + stepUp / 100;
    }
    return { value, invested };
  };

  let lo = 0;
  let hi = Math.max(100, targetValue / Math.max(1, months));
  while (simulate(hi).value < targetValue && hi < 1e9) hi *= 2;
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    if (simulate(mid).value < targetValue) lo = mid;
    else hi = mid;
    if (hi - lo < tolerate) break;
  }
  const monthly = (lo + hi) / 2;
  const result = simulate(monthly);
  return {
    monthlyInvestment: monthly,
    totalInvested: result.invested,
    totalGrowth: result.value - result.invested,
    note:
      'This is a deterministic projection from a single assumed return. Real returns arrive in an order that matters, especially for goals with a fixed date. Stress-test the plan with the Monte Carlo simulator before treating the required contribution as sufficient.',
  };
}

/** Glide path: equity allocation declining toward the goal date. */
export function glidePath(
  years: number,
  startEquity: number,
  endEquity: number,
  shape: 'linear' | 'front-loaded' | 'back-loaded' = 'linear',
): { year: number; equity: number; debt: number }[] {
  const out: { year: number; equity: number; debt: number }[] = [];
  for (let y = 0; y <= years; y += 1) {
    const t = years === 0 ? 0 : y / years;
    const shaped = shape === 'front-loaded' ? Math.pow(t, 0.5) : shape === 'back-loaded' ? t * t : t;
    const equity = startEquity + (endEquity - startEquity) * shaped;
    out.push({ year: y, equity, debt: 1 - equity });
  }
  return out;
}

/**
 * Tax drag from portfolio turnover.
 *
 * A strategy that realises gains every year converts a deferred capital gain
 * into an annual tax cost, and the compounding that is lost is larger than the
 * sum of the tax payments.
 */
export function taxDragFromTurnover(
  turnoverRate: number,
  annualGainRate: number,
  taxRate: number,
  years: number,
  deferredTaxRate = taxRate,
): { annualTaxDrag: number; terminalDrag: number; effectiveAnnualCost: number } {
  const realisedGainPerYear = turnoverRate * annualGainRate;
  const annualTax = realisedGainPerYear * taxRate;
  const preTax = Math.pow(1 + annualGainRate, years);
  const postTaxRepeated = Math.pow(1 + annualGainRate - annualTax, years);
  const postTaxDeferred = preTax - (preTax - 1) * deferredTaxRate;
  return {
    annualTaxDrag: annualTax,
    terminalDrag: postTaxDeferred > 0 ? postTaxRepeated / postTaxDeferred - 1 : Number.NaN,
    effectiveAnnualCost: annualTax,
  };
}

/** Liquidity coverage: months of expenses covered by same-day-accessible assets. */
export function liquidityCoverage(
  liquidAssets: number,
  monthlyExpenses: number,
): { coverageMonths: number; assessment: string } {
  const coverageMonths = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : Number.POSITIVE_INFINITY;
  const assessment =
    coverageMonths >= 12
      ? 'Substantial liquidity buffer. Consider whether the excess is earning a real return.'
      : coverageMonths >= 6
        ? 'Adequate for most circumstances.'
        : coverageMonths >= 3
          ? 'Thin. A job loss, a medical event or a capital call would force a sale at an inopportune time.'
          : 'Insufficient. Below three months, the portfolio is effectively forced to sell into weakness.';
  return { coverageMonths, assessment };
}

/** Simple correlation sanity check across a set of real return series. */
export function summariseCorrelations(series: Record<string, number[]>): {
  pairs: { a: string; b: string; correlation: number | null }[];
  averageCorrelation: number | null;
} {
  const keys = Object.keys(series);
  const pairs: { a: string; b: string; correlation: number | null }[] = [];
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      const a = keys[i];
      const b = keys[j];
      if (a === undefined || b === undefined) continue;
      const sa = series[a];
      const sb = series[b];
      if (!sa || !sb) continue;
      pairs.push({ a, b, correlation: correlation(sa, sb) });
    }
  }
  const valid = pairs.map((p) => p.correlation).filter((c): c is number => c !== null);
  return {
    pairs,
    averageCorrelation: valid.length > 0 ? (mean(valid) ?? null) : null,
  };
}

/** Annualised standard error of a mean return estimate — the "how sure are we" number. */
export function standardErrorOfMean(returns: number[]): number | null {
  const sd = stdev(returns);
  if (sd === null || returns.length === 0) return null;
  return sd / Math.sqrt(returns.length);
}

/** Sharpe ratio ratio test: how many years of data to detect a given Sharpe. */
export function yearsToDetectSharpe(sharpe: number, confidence = 1.96): number | null {
  if (sharpe === 0) return null;
  return (confidence / sharpe) ** 2;
}

/** Mismatch guard: a portfolio's data frequencies must not be silently mixed. */
export function assertComparableFrequency(frequencies: string[]): ValidationIssue[] {
  const unique = [...new Set(frequencies)];
  if (unique.length > 1) {
    return [
      {
        field: 'frequency',
        message: `Return series of different frequencies (${unique.join(', ')}) cannot be combined without annualisation. Annualise each series with its own stated method first.`,
        severity: 'error',
      },
    ];
  }
  return [];
}
