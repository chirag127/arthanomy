/**
 * Fixed-income mathematics.
 *
 * Bond pricing is where retail investing most often goes wrong, because the
 * relationship between price, yield, duration and credit is non-linear and
 * because quoting conventions differ between markets. Conventions used here:
 *
 *  - Prices are per 100 of face value unless stated otherwise.
 *  - Yields are nominal annual yields compounded `frequency` times per year.
 *  - Day counts are expressed as a fraction of the current coupon period, so
 *    the functions do not need to know which day-count convention a particular
 *    Indian instrument uses. The caller supplies the fraction and states the
 *    convention in the article.
 *  - No function silently assumes a value it was not given.
 */

export interface BondSpec {
  /** Redemption value per 100 face. Defaults to 100 (par redemption). */
  redemptionValue?: number;
  /** Annual coupon rate as a fraction, e.g. 0.0725 for 7.25% p.a. */
  couponRate: number;
  /** Coupon payments per year: 1 = annual, 2 = semi-annual, 4 = quarterly, 12 = monthly. */
  frequency: number;
  /** Years from settlement to maturity. */
  yearsToMaturity: number;
  /**
   * Fraction (0-1) of the current coupon period that has already elapsed.
   * 0 means settlement falls exactly on a coupon date.
   */
  accruedFraction?: number;
}

export interface BondPriceResult {
  /** Present value of all future cash flows, including accrued interest. */
  dirtyPrice: number;
  /** Traded price: dirty price less accrued interest. */
  cleanPrice: number;
  accruedInterest: number;
  annualCouponPer100: number;
  periodsRemaining: number;
  futureCashFlows: { period: number; yearsAhead: number; cashFlow: number; presentValue: number }[];
}

/**
 * Price a bond from its yield to maturity.
 *
 * Cash flows are discounted at (1 + y/f) raised to the number of periods
 * remaining, where the first period is shortened by the fraction of the coupon
 * period already elapsed. This is the standard street convention and it makes
 * the price continuous across coupon dates.
 */
export function priceBond(spec: BondSpec, annualYield: number): BondPriceResult {
  const frequency = spec.frequency || 1;
  const redemption = spec.redemptionValue ?? 100;
  const accruedFraction = Math.min(0.999999, Math.max(0, spec.accruedFraction ?? 0));
  const couponPerPeriod = (spec.couponRate * 100) / frequency;
  const remaining = Math.max(0, spec.yearsToMaturity * frequency);

  const ratePerPeriod = annualYield / frequency;
  const futureCashFlows: BondPriceResult['futureCashFlows'] = [];
  let dirty = 0;

  // The exponent for the k-th remaining coupon is (k - accruedFraction) periods
  // from settlement. The final cash flow also carries principal.
  const fullPeriods = Math.ceil(remaining - 1e-9);
  for (let k = 1; k <= fullPeriods; k += 1) {
    const exponent = k - accruedFraction;
    const isLast = k === fullPeriods;
    const cashFlow = couponPerPeriod + (isLast ? redemption : 0);
    const discount = Math.pow(1 + ratePerPeriod, -exponent);
    const presentValue = cashFlow * discount;
    dirty += presentValue;
    futureCashFlows.push({
      period: k,
      yearsAhead: exponent / frequency,
      cashFlow,
      presentValue,
    });
  }

  const accruedInterest = couponPerPeriod * accruedFraction;
  return {
    dirtyPrice: dirty,
    cleanPrice: dirty - accruedInterest,
    accruedInterest,
    annualCouponPer100: spec.couponRate * 100,
    periodsRemaining: remaining,
    futureCashFlows,
  };
}

/**
 * Solve for the yield to maturity that reproduces an observed clean price.
 * Uses Newton–Raphson with a bracketed bisection fallback so that a
 * deep-discount or high-premium bond cannot produce a silent failure.
 */
export function yieldFromPrice(
  spec: BondSpec,
  cleanPrice: number,
  options: { guess?: number; tolerance?: number } = {},
): { yield: number | null; converged: boolean; framework: string; error?: string } {
  const tolerance = options.tolerance ?? 1e-10;
  const f = (y: number): number => priceBond(spec, y).cleanPrice - cleanPrice;

  let y = options.guess ?? Math.max(0.01, spec.couponRate);
  for (let i = 0; i < 200; i += 1) {
    const v = f(y);
    if (Math.abs(v) < tolerance) {
      return { yield: y, converged: true, framework: 'Newton–Raphson' };
    }
    const dy = 1e-6;
    const derivative = (f(y + dy) - v) / dy;
    if (!Number.isFinite(derivative) || derivative === 0) break;
    const step = Math.max(-0.25, Math.min(0.25, v / derivative));
    const next = y - step;
    if (!Number.isFinite(next) || next <= -0.999) break;
    if (Math.abs(next - y) < 1e-14) break;
    y = next;
  }

  let lo = -0.99;
  let hi = 5;
  let flo = f(lo);
  let fhi = f(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) {
    // Widen once; beyond this the price is outside any credible yield range.
    hi = 50;
    fhi = f(hi);
    if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) {
      return {
        yield: null,
        converged: false,
        framework: 'bracketed bisection',
        error:
          'No yield between −99% and 5,000% reproduces the given price for these cash flows. Check the price, the coupon, the redemption value and the accrued-interest convention.',
      };
    }
  }
  for (let i = 0; i < 500; i += 1) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < tolerance || hi - lo < 1e-13) {
      return { yield: mid, converged: Math.abs(fm) < 1e-6, framework: 'bracketed bisection' };
    }
    if (flo * fm < 0) {
      hi = mid;
      fhi = fm;
    } else {
      lo = mid;
      flo = fm;
    }
  }
  return { yield: (lo + hi) / 2, converged: false, framework: 'bracketed bisection', error: 'Did not reach tolerance.' };
}

/* ---------------------------- Duration and convexity ---------------------------- */

export interface DurationResult {
  /** Macaulay duration in years: present-value-weighted average time to cash flow. */
  macaulayDuration: number | null;
  /** Modified duration: percentage price change per unit change in yield. */
  modifiedDuration: number | null;
  /** Numerically-estimated effective duration, valid for embedded-option bonds. */
  effectiveDuration: number | null;
  /** Convexity: second-order price sensitivity. */
  convexity: number | null;
  /** Price value of a basis point, per 100 face. */
  dv01: number | null;
  warning?: string;
}

/**
 * Full duration and convexity set for a bond.
 *
 * Macaulay and modified duration are computed analytically from the priced cash
 * flows. Effective duration and convexity are computed by re-pricing at ±25bp,
 * which is the only correct method when cash flows can change (callable,
 * puttable or amortising bonds) — for a plain vanilla bond the two should
 * agree closely, and a large gap is itself a finding worth reporting.
 */
export function bondDurations(spec: BondSpec, annualYield: number, shock = 0.0025): DurationResult {
  const priced = priceBond(spec, annualYield);
  const p0 = priced.dirtyPrice;
  if (p0 <= 0) {
    return {
      macaulayDuration: null,
      modifiedDuration: null,
      effectiveDuration: null,
      convexity: null,
      dv01: null,
      warning: 'Duration is undefined for a bond whose present value is zero or negative.',
    };
  }

  let weightedTime = 0;
  for (const cf of priced.futureCashFlows) {
    weightedTime += cf.yearsAhead * cf.presentValue;
  }
  const macaulay = weightedTime / p0;
  const modified = macaulay / (1 + annualYield / spec.frequency);

  const up = priceBond(spec, annualYield + shock).dirtyPrice;
  const down = priceBond(spec, annualYield - shock).dirtyPrice;
  const effective = -(up - down) / (2 * p0 * shock);
  const convexity = (up + down - 2 * p0) / (p0 * shock * shock);
  const dv01 = modified * p0 * 0.0001;

  const warning =
    Math.abs(effective - modified) > 0.25
      ? 'Effective duration differs materially from modified duration. For a bond with embedded options or irregular cash flows, only effective duration is reliable.'
      : undefined;

  return {
    macaulayDuration: macaulay,
    modifiedDuration: modified,
    effectiveDuration: effective,
    convexity,
    dv01,
    ...(warning === undefined ? {} : { warning }),
  };
}

/**
 * Estimate a price change from duration and convexity.
 *
 * ΔP/P ≈ −D_mod·Δy + ½·C·Δy²
 *
 * The second-order term is what makes the price–yield relationship convex, and
 * ignoring it understates gains and overstates losses for large yield moves.
 */
export function priceChangeEstimate(
  modifiedDuration: number,
  convexity: number,
  yieldChange: number,
): { linearOnly: number; withConvexity: number; convexityContribution: number } {
  const linear = -modifiedDuration * yieldChange;
  const conv = 0.5 * convexity * yieldChange * yieldChange;
  return { linearOnly: linear, withConvexity: linear + conv, convexityContribution: conv };
}

/** Exact proportional price change for a plain bond, for comparison with the estimate. */
export function exactPriceChange(spec: BondSpec, yieldFrom: number, yieldTo: number): number | null {
  const p0 = priceBond(spec, yieldFrom).dirtyPrice;
  const p1 = priceBond(spec, yieldTo).dirtyPrice;
  if (p0 <= 0) return null;
  return p1 / p0 - 1;
}

/* ---------------------------- Credit and default ---------------------------- */

export interface CreditInputs {
  /** Annual probability of default as a fraction. */
  probabilityOfDefault: number;
  /** Fraction of exposure recovered in the event of default. */
  recoveryRate: number;
  /** Annual risk-free (or benchmark) rate used for discounting. */
  riskFreeRate: number;
  couponRate: number;
  frequency: number;
  yearsToMaturity: number;
}

export interface CreditResult {
  /** Present value under the reduced-form model, per 100 face. */
  riskyPrice: number;
  riskFreePrice: number;
  /** Implied credit spread: the yield that equates risky cash flows to the risk-free price. */
  impliedSpread: number;
  expectedLossPer100: number;
  /** Probability that cumulative defaults consume more than 10% of principal. */
  survivalToMaturity: number;
  cumulativeDefaultProbability: number;
  /** Fair compensation for expected loss, ignoring risk premia and liquidity. */
  breakEvenSpread: number;
}

/**
 * Reduced-form (hazard-rate) bond valuation.
 *
 * Each period, the bond either survives and pays its coupon, or defaults and
 * pays recovery on the face. The recovery is assumed to occur at the default
 * date. This is the model used in practice to convert an observed price into
 * a market-implied default assumption, and it makes the compensation for risk
 * explicit: the break-even spread is the spread at which the investor is
 * exactly indifferent, ignoring risk premia and liquidity.
 */
export function creditValuation(input: CreditInputs): CreditResult {
  const { probabilityOfDefault, recoveryRate, riskFreeRate, couponRate, frequency, yearsToMaturity } = input;
  const periods = Math.max(1, Math.round(yearsToMaturity * frequency));
  const coupon = (couponRate * 100) / frequency;
  const discountRate = riskFreeRate / frequency;
  const survivalPerPeriod = 1 - probabilityOfDefault / frequency;
  const defaultPerPeriod = 1 - survivalPerPeriod;

  let riskyPrice = 0;
  let survival = 1;
  for (let k = 1; k <= periods; k += 1) {
    const df = Math.pow(1 + discountRate, -k);
    const defaultThisPeriod = survival * defaultPerPeriod;
    const survivalThisPeriod = survival * survivalPerPeriod;
    const isLast = k === periods;
    // Survival leg: coupon, plus principal at maturity.
    riskyPrice += df * survivalThisPeriod * (coupon + (isLast ? 100 : 0));
    // Default leg: recovery on face, assumed paid at the default date.
    riskyPrice += df * defaultThisPeriod * recoveryRate * 100;
    survival = survivalThisPeriod;
  }

  // Risk-free price for the same cash flows.
  const riskFreePrice = (() => {
    let p = 0;
    for (let k = 1; k <= periods; k += 1) {
      const df = Math.pow(1 + discountRate, -k);
      p += df * (coupon + (k === periods ? 100 : 0));
    }
    return p;
  })();

  // Solve for the yield that reproduces the risky price, then subtract the risk-free yield.
  const spec: BondSpec = { couponRate, frequency, yearsToMaturity, redemptionValue: 100 };
  const riskyYield = yieldFromPrice(spec, riskyPrice).yield;
  const riskFreeYield = yieldFromPrice(spec, riskFreePrice).yield;
  const impliedSpread = riskyYield !== null && riskFreeYield !== null ? riskyYield - riskFreeYield : Number.NaN;

  const expectedLossPer100 = probabilityOfDefault * (1 - recoveryRate) * 100;

  return {
    riskyPrice,
    riskFreePrice,
    impliedSpread,
    expectedLossPer100,
    survivalToMaturity: Math.pow(1 - probabilityOfDefault, yearsToMaturity),
    cumulativeDefaultProbability: 1 - Math.pow(1 - probabilityOfDefault, yearsToMaturity),
    // The exact break-even spread solves (1 + rf + s) pricing to the same price
    // as the risk-free bond; the continuous approximation (1 − R)·PD is shown
    // as a cross-check in the UI, not as the answer.
    breakEvenSpread: impliedSpread,
  };
}

/**
 * Expected credit loss in the standard banking form:
 *   ECL = PD × LGD × EAD
 * with LGD = 1 − recovery. Used for P2P portfolios and unsecured lending.
 */
export function expectedCreditLoss(
  exposure: number,
  probabilityOfDefault: number,
  recoveryRate: number,
): { expectedLoss: number; lossGivenDefault: number; lossRate: number } {
  const lossGivenDefault = 1 - recoveryRate;
  const lossRate = probabilityOfDefault * lossGivenDefault;
  return { expectedLoss: exposure * lossRate, lossGivenDefault, lossRate };
}

/** Credit spread in basis points implied by two yields. */
export function spreadInBps(riskyYield: number, benchmarkYield: number): number {
  return (riskyYield - benchmarkYield) * 10_000;
}

/** Excess return required to compensate for an expected loss. */
export function requiredYieldForLoss(
  benchmarkYield: number,
  probabilityOfDefault: number,
  recoveryRate: number,
): number {
  const lossRate = probabilityOfDefault * (1 - recoveryRate);
  // (1 + y) = (1 + rf) / (1 − lossRate) keeps the expected compounded outcome whole.
  return (1 + benchmarkYield) / Math.max(1e-9, 1 - lossRate) - 1;
}

/* ---------------------------- Short-dated instruments ---------------------------- */

/**
 * Treasury bill and commercial paper conventions.
 *
 * Discount instruments quote a discount rate on face value; the investment
 * yield on the price paid is materially higher, and the gap widens with the
 * tenor. Presenting the two as if they were the same number is a common
 * marketing technique and a common error.
 */
export function moneyMarketQuote(
  faceValue: number,
  discountRate: number,
  days: number,
  dayCountBasis = 365,
): { price: number; discountYield: number; investmentYield: number; effectiveAnnualYield: number } {
  const price = faceValue * (1 - (discountRate * days) / dayCountBasis);
  const investmentYield = (faceValue - price) / price;
  const annualised = Math.pow(faceValue / price, dayCountBasis / days) - 1;
  return {
    price,
    discountYield: discountRate,
    investmentYield: (investmentYield * dayCountBasis) / days,
    effectiveAnnualYield: annualised,
  };
}

/* ---------------------------- Yield curve ---------------------------- */

export interface CurvePoint {
  years: number;
  yield: number;
}

/** Linear interpolation of a yield curve, flat-extrapolated beyond the ends. */
export function interpolateCurve(curve: CurvePoint[], years: number): number | null {
  if (curve.length === 0) return null;
  const sorted = [...curve].sort((a, b) => a.years - b.years);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return null;
  if (years <= first.years) return first.yield;
  if (years >= last.years) return last.yield;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (!a || !b) continue;
    if (years >= a.years && years <= b.years) {
      const w = (years - a.years) / (b.years - a.years);
      return a.yield + w * (b.yield - a.yield);
    }
  }
  return null;
}

/**
 * Forward rate implied by two spot rates: the rate that makes an investor
 * indifferent between two consecutive spot investments and a single
 * investment to the later date.
 */
export function forwardRate(
  spotShort: number,
  yearsShort: number,
  spotLong: number,
  yearsLong: number,
): number | null {
  if (yearsShort <= 0 || yearsLong <= yearsShort) return null;
  const numerator = Math.pow(1 + spotLong, yearsLong);
  const denominator = Math.pow(1 + spotShort, yearsShort);
  return Math.pow(numerator / denominator, 1 / (yearsLong - yearsShort)) - 1;
}

/** Nelson–Siegel parameterisation, used to visualise curve shapes. */
export function nelsonSiegel(
  beta0: number,
  beta1: number,
  beta2: number,
  tau: number,
  years: number,
): number {
  if (tau <= 0 || years <= 0) return beta0 + beta1;
  const x = years / tau;
  const decay = (1 - Math.exp(-x)) / x;
  return beta0 + beta1 * decay + beta2 * (decay - Math.exp(-x));
}

/** Par yield for a given coupon frequency and spot curve. */
export function parYield(curve: CurvePoint[], frequency: number): number | null {
  const points = curve.filter((p) => p.years > 0).sort((a, b) => a.years - b.years);
  if (points.length === 0) return null;
  const longest = points[points.length - 1];
  if (!longest) return null;
  const periods = Math.max(1, Math.round(longest.years * frequency));
  let denominator = 0;
  for (let k = 1; k <= periods; k += 1) {
    const t = k / frequency;
    const z = interpolateCurve(points, t);
    if (z === null) continue;
    denominator += Math.pow(1 + z / frequency, -k);
  }
  if (denominator === 0) return null;
  const redemptionDiscount = (() => {
    const z = interpolateCurve(points, longest.years);
    return z === null ? 1 : Math.pow(1 + z / frequency, -periods);
  })();
  return (frequency * (1 - redemptionDiscount)) / denominator;
}

/* ---------------------------- Floating-rate and reset risk ---------------------------- */

/**
 * Price change of a floating-rate note around a reset date.
 *
 * At each reset the coupon is re-fixed to the benchmark, so the note's
 * duration collapses to approximately the time to the next reset. This is why
 * a floating-rate note and a fixed-rate bond with the same maturity carry very
 * different interest-rate risk — a distinction that is often glossed over.
 */
export function floatingRateNoteRisk(
  _spread: number,
  _benchmarkYield: number,
  yearsToNextReset: number,
  resetFrequency: number,
): { effectiveDuration: number; priceSensitivityPer100Bps: number; note: string } {
  const duration = resetFrequency > 0 ? yearsToNextReset : 0;
  return {
    effectiveDuration: duration,
    priceSensitivityPer100Bps: -duration * 0.01,
    note: 'Duration is measured to the next reset, not to maturity. A floating-rate note with a 15-year maturity can have a duration of a few months.',
  };
}

/**
 * Perpetual bond and AT1 pricing.
 *
 * For a bond with no maturity date, price = coupon / yield. AT1 instruments add
 * two features that this formula cannot capture: a call option at the issuer's
 * discretion and statutory loss absorption that can write the principal down
 * to zero. The function states both limitations in its return value so that a
 * displayed price cannot be mistaken for a promise.
 */
export function perpetualBondPrice(
  couponPer100: number,
  yieldRequired: number,
): { price: number; limitations: string[] } {
  if (yieldRequired <= 0) {
    return {
      price: Number.NaN,
      limitations: ['A required yield of zero or less makes the perpetuity price undefined.'],
    };
  }
  return {
    price: couponPer100 / yieldRequired,
    limitations: [
      'The perpetuity formula assumes the coupon is paid forever and never skipped. Indian AT1 instruments permit the issuer to skip coupons in specified circumstances.',
      'It ignores the issuer call, which truncates the cash flows and creates reinvestment risk at the call date.',
      'It ignores loss absorption: the principal can be written down or converted to equity, in which case the realised cash flow is not the coupon stream at all.',
      'Bonds of this type have traded at material discounts to this formula in stressed markets precisely because of the first three points.',
    ],
  };
}

/** Credit-rating migration effect on a simple two-state (hold/migrate) model. */
export function migrationPriceImpact(
  priceBefore: number,
  priceAfter: number,
  exposure: number,
): { priceChangePercent: number; profitLoss: number } {
  return {
    priceChangePercent: priceBefore > 0 ? priceAfter / priceBefore - 1 : Number.NaN,
    profitLoss: (priceAfter - priceBefore) * exposure,
  };
}
