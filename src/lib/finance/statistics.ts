/**
 * Statistical and risk primitives used across the calculators and charts.
 *
 * All functions are pure and deterministic. The Monte Carlo routines accept an
 * explicit seed so that a published chart can be reproduced exactly — an
 * unreproducible simulation is not evidence.
 */

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Sample variance (n − 1 denominator), the correct estimator for market data. */
export function variance(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values);
  if (m === null) return null;
  const ss = values.reduce((s, v) => s + (v - m) * (v - m), 0);
  return ss / (values.length - 1);
}

export function stdev(values: number[]): number | null {
  const v = variance(values);
  return v === null ? null : Math.sqrt(v);
}

/** Population standard deviation — for a complete set, not a sample. */
export function stdevPopulation(values: number[]): number | null {
  if (values.length < 1) return null;
  const m = mean(values);
  if (m === null) return null;
  const ss = values.reduce((s, v) => s + (v - m) * (v - m), 0);
  return Math.sqrt(ss / values.length);
}

export function covariance(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  if (ma === null || mb === null) return null;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const av = a[i];
    const bv = b[i];
    if (av === undefined || bv === undefined) continue;
    sum += (av - ma) * (bv - mb);
  }
  return sum / (n - 1);
}

/**
 * Pearson correlation. Returns null when either series has zero variance,
 * because correlation is undefined in that case — returning 0 would imply
 * "no relationship", which is a different and stronger claim.
 */
export function correlation(a: number[], b: number[]): number | null {
  const cov = covariance(a, b);
  const sa = stdev(a);
  const sb = stdev(b);
  if (cov === null || sa === null || sb === null) return null;
  if (sa === 0 || sb === 0) return null;
  return cov / (sa * sb);
}

export function correlationMatrix(series: number[][]): (number | null)[][] {
  return series.map((rowA) => series.map((rowB) => correlation(rowA, rowB)));
}

/** Covariance matrix from a set of return series. */
export function covarianceMatrix(series: number[][]): (number | null)[][] {
  return series.map((rowA) => series.map((rowB) => covariance(rowA, rowB)));
}

export interface CapmResult {
  beta: number | null;
  alpha: number | null;
  rSquared: number | null;
  /** Standard error of the beta estimate. */
  betaStdError: number | null;
}

/**
 * Ordinary least squares of asset excess returns on benchmark excess returns.
 * Beta without a standard error is not a finding; it is a point estimate whose
 * reliability is unknown, so the standard error is returned alongside.
 */
export function capmRegression(
  assetReturns: number[],
  benchmarkReturns: number[],
  riskFreeRate = 0,
): CapmResult {
  const n = Math.min(assetReturns.length, benchmarkReturns.length);
  if (n < 3) return { beta: null, alpha: null, rSquared: null, betaStdError: null };
  const x = benchmarkReturns.slice(0, n).map((r) => r - riskFreeRate);
  const y = assetReturns.slice(0, n).map((r) => r - riskFreeRate);
  const mx = mean(x);
  const my = mean(y);
  if (mx === null || my === null) return { beta: null, alpha: null, rSquared: null, betaStdError: null };
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const xi = x[i];
    const yi = y[i];
    if (xi === undefined || yi === undefined) continue;
    sxx += (xi - mx) ** 2;
    sxy += (xi - mx) * (yi - my);
    syy += (yi - my) ** 2;
  }
  if (sxx === 0) return { beta: null, alpha: null, rSquared: null, betaStdError: null };
  const beta = sxy / sxx;
  const alpha = my - beta * mx;
  const rSquared = syy === 0 ? null : (sxy * sxy) / (sxx * syy);
  let residualSS = 0;
  for (let i = 0; i < n; i += 1) {
    const xi = x[i];
    const yi = y[i];
    if (xi === undefined || yi === undefined) continue;
    residualSS += (yi - (alpha + beta * xi)) ** 2;
  }
  const dof = n - 2;
  const betaStdError = dof > 0 ? Math.sqrt(residualSS / dof / sxx) : null;
  // The intercept of a regression on excess returns IS Jensen's alpha.
  return { beta, alpha, rSquared, betaStdError };
}

/* ---------------------------- Downside risk ---------------------------- */

/** Downside deviation relative to a minimum acceptable return (default 0). */
export function downsideDeviation(returns: number[], targetReturn = 0): number | null {
  if (returns.length === 0) return null;
  const shortfalls = returns.filter((r) => r < targetReturn).map((r) => (r - targetReturn) ** 2);
  if (shortfalls.length === 0) return 0;
  return Math.sqrt(shortfalls.reduce((s, v) => s + v, 0) / returns.length);
}

export function sharpeRatio(
  returns: number[],
  riskFreeRate = 0,
  periodsPerYear = 1,
): number | null {
  const annualReturn = geometricAnnualise(returns, periodsPerYear);
  if (annualReturn === null) return null;
  const sd = stdev(returns);
  if (sd === null || sd === 0) return null;
  const annualisedSd = sd * Math.sqrt(periodsPerYear);
  return (annualReturn - riskFreeRate) / annualisedSd;
}

export function sortinoRatio(
  returns: number[],
  riskFreeRate = 0,
  periodsPerYear = 1,
  targetReturn = 0,
): number | null {
  const annualReturn = geometricAnnualise(returns, periodsPerYear);
  if (annualReturn === null) return null;
  const dd = downsideDeviation(returns, targetReturn);
  if (dd === null || dd === 0) return null;
  const annualisedDd = dd * Math.sqrt(periodsPerYear);
  return (annualReturn - riskFreeRate) / annualisedDd;
}

export function treynorRatio(
  returns: number[],
  benchmarkReturns: number[],
  riskFreeRate = 0,
  periodsPerYear = 1,
): number | null {
  const annualReturn = geometricAnnualise(returns, periodsPerYear);
  if (annualReturn === null) return null;
  const { beta } = capmRegression(returns, benchmarkReturns, riskFreeRate / periodsPerYear);
  if (beta === null || beta === 0) return null;
  return (annualReturn - riskFreeRate) / beta;
}

export function informationRatio(
  returns: number[],
  benchmarkReturns: number[],
  periodsPerYear = 1,
): number | null {
  const n = Math.min(returns.length, benchmarkReturns.length);
  if (n < 2) return null;
  const active = returns.slice(0, n).map((r, i) => r - (benchmarkReturns[i] ?? 0));
  const m = mean(active);
  const sd = stdev(active);
  if (m === null || sd === null || sd === 0) return null;
  return (m * periodsPerYear) / (sd * Math.sqrt(periodsPerYear));
}

export function geometricAnnualise(returns: number[], periodsPerYear: number): number | null {
  if (returns.length === 0) return null;
  let product = 1;
  for (const r of returns) {
    if (r <= -1) return -1;
    product *= 1 + r;
  }
  return Math.pow(product, periodsPerYear / returns.length) - 1;
}

/* ---------------------------- Drawdown ---------------------------- */

export interface DrawdownAnalysis {
  maxDrawdown: number;
  peakIndex: number;
  troughIndex: number;
  /** Number of periods from peak to trough. */
  declineLength: number;
  /** Number of periods from trough back to the previous peak, or null if not recovered. */
  recoveryLength: number | null;
  recovered: boolean;
  drawdownSeries: number[];
  /** Longest stretch of periods below a prior peak. */
  longestUnderwater: number;
}

/**
 * Full drawdown analysis of an indexed value series (e.g. NAV or portfolio
 * value). Recovery length is measured against the specific peak that preceded
 * the trough, not against any later higher level — a distinction that changes
 * reported recovery times materially.
 */
export function analyseDrawdowns(values: number[]): DrawdownAnalysis | null {
  if (values.length < 2) return null;

  const drawdownSeries: number[] = [];
  let peak = values[0] ?? 0;
  let peakIndex = 0;
  let maxDrawdown = 0;
  let worstPeak = 0;
  let worstTrough = 0;
  let longestUnderwater = 0;
  let underwaterStart: number | null = null;

  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (v === undefined) continue;
    if (v >= peak) {
      if (underwaterStart !== null) {
        longestUnderwater = Math.max(longestUnderwater, i - underwaterStart);
        underwaterStart = null;
      }
      peak = v;
      peakIndex = i;
      drawdownSeries.push(0);
      continue;
    }
    if (underwaterStart === null) underwaterStart = i;
    const dd = v / peak - 1;
    drawdownSeries.push(dd);
    if (dd < maxDrawdown) {
      maxDrawdown = dd;
      worstPeak = peakIndex;
      worstTrough = i;
    }
  }
  if (underwaterStart !== null) {
    longestUnderwater = Math.max(longestUnderwater, values.length - underwaterStart);
  }

  // Recovery: does value exceed the pre-trough peak again?
  let recoveryLength: number | null = null;
  const peakValue = values[worstPeak] ?? 0;
  for (let i = worstTrough + 1; i < values.length; i += 1) {
    const v = values[i];
    if (v !== undefined && v >= peakValue) {
      recoveryLength = i - worstTrough;
      break;
    }
  }

  return {
    maxDrawdown,
    peakIndex: worstPeak,
    troughIndex: worstTrough,
    declineLength: worstTrough - worstPeak,
    recoveryLength,
    recovered: recoveryLength !== null,
    drawdownSeries,
    longestUnderwater,
  };
}

/* ---------------------------- Distribution shape ---------------------------- */

export function skewness(values: number[]): number | null {
  const n = values.length;
  if (n < 3) return null;
  const m = mean(values);
  const sd = stdevPopulation(values);
  if (m === null || sd === null || sd === 0) return null;
  const third = values.reduce((s, v) => s + ((v - m) / sd) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * third;
}

export function kurtosis(values: number[]): number | null {
  const n = values.length;
  if (n < 4) return null;
  const m = mean(values);
  const sd = stdevPopulation(values);
  if (m === null || sd === null || sd === 0) return null;
  const fourth = values.reduce((s, v) => s + ((v - m) / sd) ** 4, 0);
  return (n * (n + 1) * fourth - 3 * (n - 1) ** 3) / ((n - 1) * (n - 2) * (n - 3));
}

/** Sort ascending, then interpolate linearly between order statistics. */
export function quantile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const clamped = Math.min(1, Math.max(0, p));
  const sorted = [...values].sort((a, b) => a - b);
  const idx = clamped * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const loVal = sorted[lo];
  const hiVal = sorted[hi];
  if (loVal === undefined || hiVal === undefined) return null;
  if (lo === hi) return loVal;
  return loVal + (idx - lo) * (hiVal - loVal);
}

/**
 * Historical Value at Risk at a given confidence level, as a (usually
 * negative) return. Reports the empirical quantile — no distributional
 * assumption — which is why the sample size matters and is returned.
 */
export function historicalVaR(
  returns: number[],
  confidence = 0.95,
): { var: number | null; sampleSize: number } {
  const q = quantile(returns, 1 - confidence);
  return { var: q, sampleSize: returns.length };
}

/** Expected shortfall (CVaR): the mean of losses beyond the VaR threshold. */
export function expectedShortfall(returns: number[], confidence = 0.95): number | null {
  const threshold = quantile(returns, 1 - confidence);
  if (threshold === null) return null;
  const tail = returns.filter((r) => r <= threshold);
  if (tail.length === 0) return null;
  return mean(tail);
}

/* ---------------------------- Rolling windows ---------------------------- */

/** Rolling compounded annualised returns over a fixed window. */
export function rollingReturns(
  values: number[],
  window: number,
  periodsPerYear = 1,
): { startIndex: number; endIndex: number; annualised: number }[] {
  const out: { startIndex: number; endIndex: number; annualised: number }[] = [];
  if (window <= 0 || values.length <= window) return out;
  for (let i = 0; i + window < values.length; i += 1) {
    const start = values[i];
    const end = values[i + window];
    if (start === undefined || end === undefined || start <= 0 || end <= 0) continue;
    const years = window / periodsPerYear;
    out.push({
      startIndex: i,
      endIndex: i + window,
      annualised: Math.pow(end / start, 1 / years) - 1,
    });
  }
  return out;
}

/** Rolling volatility over a fixed window. */
export function rollingVolatility(
  returns: number[],
  window: number,
  periodsPerYear = 1,
): { startIndex: number; endIndex: number; volatility: number }[] {
  const out: { startIndex: number; endIndex: number; volatility: number }[] = [];
  for (let i = 0; i + window <= returns.length; i += 1) {
    const slice = returns.slice(i, i + window);
    const sd = stdev(slice);
    if (sd === null) continue;
    out.push({ startIndex: i, endIndex: i + window, volatility: sd * Math.sqrt(periodsPerYear) });
  }
  return out;
}

/* ---------------------------- Monte Carlo ---------------------------- */

/** Deterministic 32-bit PRNG — the same seed always reproduces the same path. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal variate by the Box–Muller transform. */
export function normalSampler(rng: () => number): () => number {
  return () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

export interface MonteCarloOptions {
  initialValue: number;
  annualReturn: number;
  annualVolatility: number;
  years: number;
  simulations?: number;
  seed?: number;
  /** Annual contribution added at the start of each year. */
  annualContribution?: number;
  /** Annual withdrawal as a fraction of the initial value, escalated by inflation. */
  withdrawalRate?: number;
  inflation?: number;
  /** 'normal' draws from a Gaussian; 'bootstrap' resamples supplied history. */
  method?: 'normal' | 'bootstrap' | 'student-t';
  /** Historical returns used when method is 'bootstrap'. */
  historicalReturns?: number[];
  /** Degrees of freedom for the student-t method (fat tails). */
  degreesOfFreedom?: number;
}

export interface MonteCarloResult {
  percentiles: { p5: number; p10: number; p25: number; p50: number; p75: number; p90: number; p95: number };
  finalValues: number[];
  medianPath: number[];
  p5Path: number[];
  p95Path: number[];
  probabilityOfLoss: number;
  probabilityOfShortfall: number;
  simulations: number;
  years: number;
  assumptions: {
    annualReturn: number;
    annualVolatility: number;
    method: string;
    seed: number;
    annualContribution: number;
    withdrawalRate: number;
  };
  limitations: string[];
}

export interface ShortfallOptions extends MonteCarloOptions {
  /** Target value that must be reached; used for the shortfall probability. */
  targetValue?: number;
}

/**
 * Monte Carlo wealth simulation.
 *
 * Percentiles are reported, never a single "expected" outcome, and the
 * assumptions and seed are returned with the result so the figure is
 * reproducible and falsifiable. The limitations list is part of the output
 * rather than optional documentation, because a Monte Carlo fan chart without
 * its assumptions is a marketing artefact.
 */
export function monteCarlo(options: ShortfallOptions): MonteCarloResult {
  const {
    initialValue,
    annualReturn,
    annualVolatility,
    years,
    simulations = 5_000,
    seed = 20_260_416,
    annualContribution = 0,
    withdrawalRate = 0,
    inflation = 0,
    method = 'normal',
    historicalReturns = [],
    degreesOfFreedom = 5,
    targetValue,
  } = options;

  const rng = mulberry32(seed);
  const gauss = normalSampler(rng);
  const horizon = Math.max(1, Math.round(years));

  const studentT = (): number => {
    // Sum of squared normals gives a chi-square; ratio gives a t variate.
    let chiSq = 0;
    for (let i = 0; i < degreesOfFreedom; i += 1) chiSq += gauss() ** 2;
    const scale = Math.sqrt(degreesOfFreedom / Math.max(chiSq, 1e-9));
    // Scale so the variate has unit variance.
    return (gauss() * scale) / Math.sqrt(degreesOfFreedom / (degreesOfFreedom - 2));
  };

  const finalValues: number[] = [];
  const paths: number[][] = [];
  let losses = 0;
  let shortfalls = 0;

  for (let s = 0; s < simulations; s += 1) {
    let value = initialValue;
    const path: number[] = [value];
    let currentWithdrawal = initialValue * withdrawalRate;
    for (let y = 0; y < horizon; y += 1) {
      value = value + annualContribution - currentWithdrawal;
      let shock: number;
      if (method === 'bootstrap' && historicalReturns.length > 1) {
        const idx = Math.floor(rng() * historicalReturns.length);
        shock = historicalReturns[idx] ?? 0;
      } else if (method === 'student-t') {
        shock = annualReturn + annualVolatility * studentT();
      } else {
        shock = annualReturn + annualVolatility * gauss();
      }
      value = Math.max(0, value * (1 + shock));
      currentWithdrawal *= 1 + inflation;
      path.push(value);
    }
    finalValues.push(value);
    if (s < 400) paths.push(path);
    if (value < initialValue) losses += 1;
    if (targetValue !== undefined && value < targetValue) shortfalls += 1;
  }

  const sorted = [...finalValues].sort((a, b) => a - b);
  const pick = (p: number): number => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)))] ?? 0;

  const pathPercentile = (p: number): number[] => {
    const out: number[] = [];
    for (let y = 0; y <= horizon; y += 1) {
      const column = paths.map((path) => path[y] ?? 0).sort((a, b) => a - b);
      out.push(column[Math.min(column.length - 1, Math.floor(p * column.length))] ?? 0);
    }
    return out;
  };

  return {
    percentiles: {
      p5: pick(0.05),
      p10: pick(0.1),
      p25: pick(0.25),
      p50: pick(0.5),
      p75: pick(0.75),
      p90: pick(0.9),
      p95: pick(0.95),
    },
    finalValues,
    medianPath: pathPercentile(0.5),
    p5Path: pathPercentile(0.05),
    p95Path: pathPercentile(0.95),
    probabilityOfLoss: losses / simulations,
    probabilityOfShortfall: targetValue !== undefined ? shortfalls / simulations : Number.NaN,
    simulations,
    years: horizon,
    assumptions: {
      annualReturn,
      annualVolatility,
      method,
      seed,
      annualContribution,
      withdrawalRate,
    },
    limitations: [
      'Returns are drawn independently each year. Real markets show volatility clustering, mean reversion and fat tails that this model does not reproduce.',
      'The annual return and volatility inputs are assumptions, not forecasts. Small changes in either shift the percentiles materially.',
      'Correlations between assets are not modelled here; use the portfolio simulator for multi-asset paths.',
      'Taxes and transaction costs are excluded unless they were netted out of the input return.',
      'A probability is a property of the model, not of the world. A 95% success rate does not mean 5 in 100 plans fail; it means the model says so given its assumptions.',
    ],
  };
}

/**
 * Probability that a withdrawal plan fails, using a bootstrap of historical
 * returns so that the fat tails and serial dependence of actual markets are at
 * least partially preserved.
 */
export function riskOfRuin(
  initialValue: number,
  annualWithdrawal: number,
  historicalReturns: number[],
  years: number,
  simulations = 2_000,
  seed = 7_777,
  escalation = 0,
): { ruinProbability: number; medianDepletionYear: number | null; simulations: number } {
  if (historicalReturns.length < 2) {
    return { ruinProbability: Number.NaN, medianDepletionYear: null, simulations: 0 };
  }
  const rng = mulberry32(seed);
  let ruined = 0;
  const depletionYears: number[] = [];
  for (let s = 0; s < simulations; s += 1) {
    let value = initialValue;
    let withdrawal = annualWithdrawal;
    let depleted: number | null = null;
    for (let y = 1; y <= years; y += 1) {
      const r = historicalReturns[Math.floor(rng() * historicalReturns.length)] ?? 0;
      value = Math.max(0, (value - withdrawal) * (1 + r));
      if (value <= 0 && depleted === null) {
        depleted = y;
        break;
      }
      withdrawal *= 1 + escalation;
    }
    if (depleted !== null) {
      ruined += 1;
      depletionYears.push(depleted);
    }
  }
  depletionYears.sort((a, b) => a - b);
  return {
    ruinProbability: ruined / simulations,
    medianDepletionYear:
      depletionYears.length > 0
        ? (depletionYears[Math.floor(depletionYears.length / 2)] ?? null)
        : null,
    simulations,
  };
}
