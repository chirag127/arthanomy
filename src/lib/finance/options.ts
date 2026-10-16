/**
 * Derivative pricing and payoff mathematics.
 *
 * Two editorial positions are encoded in this module.
 *
 * 1. The Black–Scholes price is a *model output*, not a market truth. Every
 *    pricing function returns the assumptions it relied on, because an option
 *    price computed with a constant volatility and continuous hedging cannot be
 *    presented as though it were the price at which the contract will settle.
 *
 * 2. High probability of profit and low risk are different things. The payoff
 *    functions therefore report maximum loss and maximum gain alongside
 *    probability-of-profit-style metrics, so that a short-premium structure
 *    cannot be displayed as though its favourable odds made it safe.
 */

/** Standard normal probability density. */
export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Standard normal cumulative distribution, Abramowitz & Stegun 7.1.26.
 * Absolute error below 7.5 × 10⁻⁸, which is far below the precision of any
 * input to a derivative-pricing calculation in a retail context.
 */
export function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.2316419 * ax);
  const poly =
    t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const approx = 1 - normalPdf(ax) * poly;
  return 0.5 * (1 + sign * (2 * approx - 1));
}

export type OptionType = 'call' | 'put';

export interface BlackScholesInputs {
  spot: number;
  strike: number;
  /** Years to expiry. Convert trading or calendar days explicitly. */
  timeToExpiry: number;
  /** Continuously compounded risk-free rate as a fraction. */
  riskFreeRate: number;
  /** Annualised volatility as a fraction. */
  volatility: number;
  /** Continuous dividend or carry yield as a fraction. */
  dividendYield?: number;
}

export interface BlackScholesResult {
  price: number;
  d1: number;
  d2: number;
  intrinsicValue: number;
  timeValue: number;
  assumptions: string[];
  warnings: string[];
}

export function blackScholes(input: BlackScholesInputs, type: OptionType): BlackScholesResult {
  const { spot, strike, timeToExpiry, riskFreeRate, volatility } = input;
  const q = input.dividendYield ?? 0;
  const warnings: string[] = [];

  const assumptions = [
    'Log-normal distribution of the underlying price with constant volatility.',
    'Continuous, costless hedging with no bid-ask spread, no transaction cost and no margin constraint.',
    'European exercise: the option can be exercised only at expiry. Indian index options are European, but stock options are physically settled and American-style in practice.',
    'A constant risk-free rate over the life of the option.',
  ];

  if (timeToExpiry <= 0) {
    const iv = type === 'call' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
    warnings.push('At expiry the option is worth exactly its intrinsic value; the model adds nothing.');
    return { price: iv, d1: Number.NaN, d2: Number.NaN, intrinsicValue: iv, timeValue: 0, assumptions, warnings };
  }
  if (volatility <= 0) {
    warnings.push('Zero volatility makes the model degenerate; the option is worth its discounted intrinsic value.');
    const forward = spot * Math.exp((riskFreeRate - q) * timeToExpiry);
    const iv = type === 'call' ? Math.max(0, forward - strike) : Math.max(0, strike - forward);
    const price = iv * Math.exp(-riskFreeRate * timeToExpiry);
    return { price, d1: Number.NaN, d2: Number.NaN, intrinsicValue: price, timeValue: 0, assumptions, warnings };
  }

  const sqrtT = Math.sqrt(timeToExpiry);
  const d1 =
    (Math.log(spot / strike) + (riskFreeRate - q + 0.5 * volatility * volatility) * timeToExpiry) /
    (volatility * sqrtT);
  const d2 = d1 - volatility * sqrtT;
  const discount = Math.exp(-riskFreeRate * timeToExpiry);
  const carry = Math.exp(-q * timeToExpiry);

  const price =
    type === 'call'
      ? spot * carry * normalCdf(d1) - strike * discount * normalCdf(d2)
      : strike * discount * normalCdf(-d2) - spot * carry * normalCdf(-d1);

  const intrinsic = type === 'call' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);

  if (price < intrinsic - 1e-8) {
    warnings.push(
      'The model price is below intrinsic value, which indicates inconsistent inputs — most often a volatility too low for the moneyness.',
    );
  }

  return {
    price,
    d1,
    d2,
    intrinsicValue: intrinsic,
    timeValue: price - intrinsic,
    assumptions,
    warnings,
  };
}

export interface Greeks {
  delta: number;
  gamma: number;
  /** Per calendar day, holding everything else constant. */
  thetaPerDay: number;
  /** Per one percentage point change in volatility. */
  vegaPerPercent: number;
  /** Per one percentage point change in the risk-free rate. */
  rhoPerPercent: number;
}

export function greeks(input: BlackScholesInputs, type: OptionType): Greeks {
  const { spot, strike, timeToExpiry, riskFreeRate, volatility } = input;
  const q = input.dividendYield ?? 0;
  if (timeToExpiry <= 0 || volatility <= 0) {
    const itm = type === 'call' ? spot > strike : spot < strike;
    return {
      delta: itm ? (type === 'call' ? Math.exp(-q * Math.max(0, timeToExpiry)) : -Math.exp(-q * Math.max(0, timeToExpiry))) : 0,
      gamma: 0,
      thetaPerDay: 0,
      vegaPerPercent: 0,
      rhoPerPercent: 0,
    };
  }
  const sqrtT = Math.sqrt(timeToExpiry);
  const d1 =
    (Math.log(spot / strike) + (riskFreeRate - q + 0.5 * volatility * volatility) * timeToExpiry) /
    (volatility * sqrtT);
  const d2 = d1 - volatility * sqrtT;
  const discount = Math.exp(-riskFreeRate * timeToExpiry);
  const carry = Math.exp(-q * timeToExpiry);
  const pdf = normalPdf(d1);

  const delta = type === 'call' ? carry * normalCdf(d1) : carry * (normalCdf(d1) - 1);
  const gamma = (carry * pdf) / (spot * volatility * sqrtT);
  const vega = spot * carry * pdf * sqrtT;

  const thetaAnnual =
    type === 'call'
      ? -(spot * carry * pdf * volatility) / (2 * sqrtT) -
        riskFreeRate * strike * discount * normalCdf(d2) +
        q * spot * carry * normalCdf(d1)
      : -(spot * carry * pdf * volatility) / (2 * sqrtT) +
        riskFreeRate * strike * discount * normalCdf(-d2) -
        q * spot * carry * normalCdf(-d1);

  const rho =
    type === 'call'
      ? (strike * timeToExpiry * discount * normalCdf(d2)) / 100
      : (-strike * timeToExpiry * discount * normalCdf(-d2)) / 100;

  return {
    delta,
    gamma,
    thetaPerDay: thetaAnnual / 365,
    vegaPerPercent: vega / 100,
    rhoPerPercent: rho,
  };
}

/**
 * Implied volatility by bisection on the Black–Scholes price.
 *
 * Bisection rather than Newton because the vega of a deep out-of-the-money
 * option is nearly zero, which makes Newton unstable exactly where retail
 * traders most often want an answer.
 */
export function impliedVolatility(
  marketPrice: number,
  input: Omit<BlackScholesInputs, 'volatility'>,
  type: OptionType,
): { volatility: number | null; converged: boolean; iterations: number; error?: string } {
  const intrinsic = type === 'call' ? Math.max(0, input.spot - input.strike) : Math.max(0, input.strike - input.spot);
  if (marketPrice < intrinsic - 1e-6) {
    return {
      volatility: null,
      converged: false,
      iterations: 0,
      error: 'The market price is below intrinsic value, so no positive volatility can reproduce it. Check the price, the strike and whether the quote is a clean or dirty price.',
    };
  }

  let lo = 1e-6;
  let hi = 5;
  let fLo = blackScholes({ ...input, volatility: lo }, type).price - marketPrice;
  let fHi = blackScholes({ ...input, volatility: hi }, type).price - marketPrice;
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) {
    return { volatility: null, converged: false, iterations: 0, error: 'Pricing failed for the bracketing volatilities.' };
  }
  let iterations = 0;
  if (fLo * fHi > 0) {
    return {
      volatility: null,
      converged: false,
      iterations,
      error:
        'No volatility between 0.0001% and 500% reproduces this price. This normally indicates a stale quote, an incorrect spot or strike, or an option with a material dividend or corporate action not captured here.',
    };
  }
  for (let i = 0; i < 200; i += 1) {
    iterations = i + 1;
    const mid = (lo + hi) / 2;
    const f = blackScholes({ ...input, volatility: mid }, type).price - marketPrice;
    if (Math.abs(f) < 1e-8 || hi - lo < 1e-10) {
      return { volatility: mid, converged: true, iterations };
    }
    if (fLo * f < 0) {
      hi = mid;
      fHi = f;
    } else {
      lo = mid;
      fLo = f;
    }
  }
  return { volatility: (lo + hi) / 2, converged: false, iterations, error: 'Did not converge within 200 iterations.' };
}

/* ---------------------------- American option valuation ---------------------------- */

export interface BinomialResult {
  price: number;
  americanPremium: number;
  europeanPrice: number;
  earlyExerciseValue: number;
  steps: number;
  note: string;
}

/**
 * Cox–Ross–Rubinstein binomial valuation with early exercise.
 *
 * For an American put on a non-dividend-paying stock in a positive-rate
 * environment, early exercise can be optimal, and its value is the
 * `earlyExerciseValue`. For calls on non-dividend payers, early exercise is
 * never optimal — a result the caller can verify rather than take on trust.
 */
export function binomialAmerican(
  input: BlackScholesInputs,
  type: OptionType,
  steps = 250,
): BinomialResult {
  const { spot, strike, timeToExpiry, riskFreeRate, volatility } = input;
  if (timeToExpiry <= 0) {
    const iv = type === 'call' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
    return { price: iv, americanPremium: 0, europeanPrice: iv, earlyExerciseValue: 0, steps: 0, note: 'Expired option.' };
  }
  const dt = timeToExpiry / steps;
  const u = Math.exp(volatility * Math.sqrt(dt));
  const d = 1 / u;
  const p = (Math.exp(riskFreeRate * dt) - d) / (u - d);
  const discount = Math.exp(-riskFreeRate * dt);

  const values = new Float64Array(steps + 1);
  for (let i = 0; i <= steps; i += 1) {
    const s = spot * Math.pow(u, i) * Math.pow(d, steps - i);
    values[i] = type === 'call' ? Math.max(0, s - strike) : Math.max(0, strike - s);
  }

  let europeanAtRoot = 0;
  for (let step = steps - 1; step >= 0; step -= 1) {
    for (let i = 0; i <= step; i += 1) {
      const continuation = discount * (p * (values[i + 1] ?? 0) + (1 - p) * (values[i] ?? 0));
      const s = spot * Math.pow(u, i) * Math.pow(d, step - i);
      const exercise = type === 'call' ? Math.max(0, s - strike) : Math.max(0, strike - s);
      values[i] = Math.max(continuation, exercise);
      if (step === 0) europeanAtRoot = continuation;
    }
  }
  const american = values[0] ?? 0;
  return {
    price: american,
    americanPremium: american - europeanAtRoot,
    europeanPrice: europeanAtRoot,
    earlyExerciseValue: Math.max(0, american - europeanAtRoot),
    steps,
    note:
      type === 'call'
        ? 'For a call on an underlying with no dividends, early exercise is never optimal in theory, so any premium here is a discretisation artefact.'
        : 'Early exercise value is real for puts when the time value of the strike price exceeds the option’s remaining time value.',
  };
}

/* ---------------------------- Payoff construction ---------------------------- */

export interface Leg {
  type: OptionType | 'stock';
  direction: 'long' | 'short';
  strike?: number;
  /** Premium paid (positive) or received (positive), used for the net-cost line. */
  premium: number;
  quantity: number;
}

export interface PayoffPoint {
  spotAtExpiry: number;
  payoff: number;
  profit: number;
}

export interface StrategyAnalysis {
  points: PayoffPoint[];
  netPremium: number;
  maxProfit: number | null;
  maxLoss: number | null;
  /** Strikes where the payoff function changes slope. */
  breakEvens: number[];
  balancedPoints: number;
  notes: string[];
}

/**
 * Payoff diagram and risk envelope for an arbitrary multi-leg structure.
 *
 * Break-evens are found by bisecting the profit function between consecutive
 * strike points, so that a ratio spread with two break-evens and an iron condor
 * with two are both handled correctly without special-casing each strategy.
 */
export function analyseStrategy(legs: Leg[], spotRange?: { min: number; max: number; steps?: number }): StrategyAnalysis {
  const strikes = legs.filter((l) => l.strike !== undefined).map((l) => l.strike as number);
  const reference = strikes.length > 0 ? Math.min(...strikes) : 100;
  const min = spotRange?.min ?? Math.max(0, reference * 0.5);
  const max = spotRange?.max ?? reference * 1.5;
  const steps = spotRange?.steps ?? 121;

  const profitAt = (spot: number): number => {
    let p = 0;
    for (const leg of legs) {
      const sign = leg.direction === 'long' ? 1 : -1;
      if (leg.type === 'stock') {
        // For a stock leg, `strike` carries the entry price.
        p += sign * leg.quantity * (spot - (leg.strike ?? 0));
        continue;
      }
      const intrinsic =
        leg.type === 'call' ? Math.max(0, spot - (leg.strike ?? 0)) : Math.max(0, (leg.strike ?? 0) - spot);
      p += sign * leg.quantity * intrinsic;
      // A long option pays the premium; a short option receives it.
      p -= sign * leg.quantity * leg.premium;
    }
    return p;
  };

  const points: PayoffPoint[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const spot = min + ((max - min) * i) / steps;
    const profit = profitAt(spot);
    points.push({ spotAtExpiry: spot, payoff: profit, profit });
  }

  const netPremium = legsNetCredit(legs);
  const { maxProfit, maxLoss } = extremePoints(legs, min, max);

  const candidateBreaks = [min, ...strikes, max].filter((s) => s >= min && s <= max).sort((a, b) => a - b);
  const breakEvens: number[] = [];
  for (let i = 0; i < candidateBreaks.length - 1; i += 1) {
    const a = candidateBreaks[i];
    const b = candidateBreaks[i + 1];
    if (a === undefined || b === undefined) continue;
    const fa = profitAt(a);
    const fb = profitAt(b);
    if (fa === 0) breakEvens.push(a);
    if (fa * fb < 0) {
      let lo = a;
      let hi = b;
      for (let j = 0; j < 80; j += 1) {
        const mid = (lo + hi) / 2;
        if (profitAt(lo) * profitAt(mid) <= 0) hi = mid;
        else lo = mid;
      }
      breakEvens.push((lo + hi) / 2);
    }
  }

  const notes: string[] = [];
  const hasShortOption = legs.some((l) => l.type !== 'stock' && l.direction === 'short');
  if (hasShortOption) {
    notes.push(
      'This structure contains short options. A high probability of a small gain is not the same as low risk: the loss distribution has a long tail, and the maximum loss is realised infrequently.',
    );
    notes.push(
      'Margin requirements on short option positions can increase substantially if the underlying moves against the position, and the exchange or broker may act before expiry.',
    );
  }
  if (legs.some((l) => l.type === 'stock' && l.direction === 'long')) {
    notes.push('Stock legs are marked at the strike field, which for a stock leg represents the purchase price.');
  }

  return {
    points,
    netPremium,
    maxProfit,
    maxLoss,
    breakEvens: [...new Set(breakEvens.map((b) => Math.round(b * 100) / 100))].sort((a, b) => a - b),
    balancedPoints: breakEvens.length,
    notes,
  };
}

/** Net premium: positive when the structure is entered for a credit. */
function legsNetCredit(legs: Leg[]): number {
  let credit = 0;
  for (const leg of legs) {
    if (leg.type === 'stock') continue;
    credit += leg.direction === 'short' ? leg.quantity * leg.premium : -leg.quantity * leg.premium;
  }
  return credit;
}

/**
 * Extreme payoff values across the plausible range. For an unbounded-loss
 * structure this returns null for maxLoss rather than a number, because
 * "unlimited" is not 0 and must not be displayed as one.
 */
function extremePoints(
  legs: Leg[],
  min: number,
  max: number,
): { maxProfit: number | null; maxLoss: number | null } {
  const valueAt = (spot: number): number => {
    let p = 0;
    for (const leg of legs) {
      const sign = leg.direction === 'long' ? 1 : -1;
      if (leg.type === 'stock') {
        p += sign * leg.quantity * (spot - (leg.strike ?? 0));
      } else {
        const intrinsic =
          leg.type === 'call' ? Math.max(0, spot - (leg.strike ?? 0)) : Math.max(0, (leg.strike ?? 0) - spot);
        p += sign * leg.quantity * intrinsic;
      }
      if (leg.type !== 'stock') {
        p += leg.direction === 'long' ? -leg.quantity * leg.premium : leg.quantity * leg.premium;
      }
    }
    return p;
  };

  const atMin = valueAt(min);
  const atMax = valueAt(max);
  const candidates = [atMin, atMax, valueAt(min * 0.001), valueAt(max * 100)];
  const finite = candidates.filter((c) => Number.isFinite(c));
  return {
    maxProfit: finite.length > 0 ? Math.max(...finite) : null,
    maxLoss: finite.length > 0 ? Math.min(...finite) : null,
  };
}

/**
 * Margin and liquidation stress for a leveraged futures position.
 *
 * Shows how a given adverse move translates into a margin call and the
 * effective leverage that a margin requirement implies. The point is that a
 * 5% margin requirement is 20× leverage, and a move of 5% against the position
 * consumes the entire margin — a fact that is routinely omitted from
 * descriptions of "just 5% margin" as an advantage.
 */
export function marginStress(
  notionalExposure: number,
  marginRequirementRate: number,
  adverseMovePercent: number,
): {
  marginPosted: number;
  impliedLeverage: number;
  lossOnMove: number;
  marginRemaining: number;
  marginCallTriggered: boolean;
  moveToWipeOutMargin: number;
} {
  const marginPosted = notionalExposure * marginRequirementRate;
  const impliedLeverage = marginRequirementRate > 0 ? 1 / marginRequirementRate : Number.POSITIVE_INFINITY;
  const lossOnMove = notionalExposure * adverseMovePercent;
  return {
    marginPosted,
    impliedLeverage,
    lossOnMove,
    marginRemaining: marginPosted - lossOnMove,
    marginCallTriggered: lossOnMove > marginPosted * 0.75,
    moveToWipeOutMargin: marginRequirementRate,
  };
}

/** Days to expiry on a calendar basis from a settlement date. */
export function timeToExpiryYears(expiry: Date, from: Date = new Date(), dayCount = 365): number {
  const days = (expiry.getTime() - from.getTime()) / 86_400_000;
  return Math.max(0, days / dayCount);
}
