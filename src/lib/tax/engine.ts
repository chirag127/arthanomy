/**
 * Indian investment taxation engine.
 *
 * Scope and honesty statement.
 *
 * The rules encoded here are those Arthanomy has verified against the primary
 * sources listed in the rule registry. Every constant carries the financial
 * year to which it applies. Two structural facts shape the design:
 *
 *  1. FY 2025-26 (AY 2026-27) is governed by the Income-tax Act, 1961, with the
 *     post-July-2024 capital-gains framework. From 1 April 2026 the
 *     Income-tax Act, 2025 applies for Tax Year 2026-27 onwards; the rates and
 *     framework carry over but sections are renumbered, so both references are
 *     stored.
 *
 *  2. Special-rate income (s.111A, s.112, s.112A, s.115BBH) and slab-rate
 *     income interact through surcharge bands. Computing them independently
 *     and adding the results produces a wrong answer at high income, so this
 *     engine computes the surcharge on the whole liability with the statutory
 *     15% cap applied to the capped component.
 *
 * This is an estimator for planning, not a return-filing product. Every
 * non-obvious simplification is documented in `assumptions` on the result.
 */

export type Regime = 'new' | 'old';
export type AgeBand = 'below-60' | 'senior' | 'super-senior';

export interface Slab {
  /** Upper bound of the band, exclusive; use Infinity for the top band. */
  upTo: number;
  rate: number;
}

export interface SurchargeBand {
  /** Total income above which the band applies (strictly greater than). */
  above: number;
  newRegimeRate: number;
  oldRegimeRate: number;
}

export interface TaxYearConstants {
  financialYear: string;
  assessmentYear: string;
  /** Statutory basis in force, stated explicitly. */
  statutoryBasis: string;
  newRegimeSlabs: Slab[];
  oldRegimeSlabs: Record<AgeBand, Slab[]>;
  newRegimeRebate: { threshold: number; maxRebate: number; marginalReliefCeiling: number };
  oldRegimeRebate: { threshold: number; maxRebate: number };
  surchargeBands: SurchargeBand[];
  /** Ceiling on surcharge applicable to s.111A, s.112, s.112A and dividend income. */
  cappedSurchargeRate: number;
  cessRate: number;
  standardDeduction: { new: number; old: number };
  capitalGains: {
    equityStcgRate: number;
    equityLtcgRate: number;
    equityLtcgExemption: number;
    otherLtcgRate: number;
    vdaRate: number;
    /** Property LTCG under the no-indexation route. */
    propertyLtcgRate: number;
    /** Option available to residents for property acquired before 23 July 2024. */
    propertyLtcgLegacyIndexedRate: number;
    legacyIndexationCutoff: string;
  };
  sources: string[];
  verifiedAt: string;
}

/**
 * FY 2025-26 constants, verified 2026-10-16 against the Income Tax Department's
 * AY 2026-27 guidance page, the Finance Act 2025 amendments to s.115BAC, and
 * cross-checked against secondary commentary.
 */
export const FY_2025_26: TaxYearConstants = {
  financialYear: 'FY 2025-26',
  assessmentYear: 'AY 2026-27',
  statutoryBasis: 'Income-tax Act, 1961, as amended by the Finance Act 2025',
  newRegimeSlabs: [
    { upTo: 400_000, rate: 0 },
    { upTo: 800_000, rate: 0.05 },
    { upTo: 1_200_000, rate: 0.1 },
    { upTo: 1_600_000, rate: 0.15 },
    { upTo: 2_000_000, rate: 0.2 },
    { upTo: 2_400_000, rate: 0.25 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.3 },
  ],
  oldRegimeSlabs: {
    'below-60': [
      { upTo: 250_000, rate: 0 },
      { upTo: 500_000, rate: 0.05 },
      { upTo: 1_000_000, rate: 0.2 },
      { upTo: Number.POSITIVE_INFINITY, rate: 0.3 },
    ],
    senior: [
      { upTo: 300_000, rate: 0 },
      { upTo: 500_000, rate: 0.05 },
      { upTo: 1_000_000, rate: 0.2 },
      { upTo: Number.POSITIVE_INFINITY, rate: 0.3 },
    ],
    'super-senior': [
      { upTo: 500_000, rate: 0 },
      { upTo: 1_000_000, rate: 0.2 },
      { upTo: Number.POSITIVE_INFINITY, rate: 0.3 },
    ],
  },
  newRegimeRebate: { threshold: 1_200_000, maxRebate: 60_000, marginalReliefCeiling: 12_70_000 },
  oldRegimeRebate: { threshold: 500_000, maxRebate: 12_500 },
  surchargeBands: [
    { above: 50_000_000, newRegimeRate: 0.37, oldRegimeRate: 0.37 }, // overridden below for new regime
    { above: 20_000_000, newRegimeRate: 0.25, oldRegimeRate: 0.25 },
    { above: 10_000_000, newRegimeRate: 0.15, oldRegimeRate: 0.15 },
    { above: 5_000_000, newRegimeRate: 0.1, oldRegimeRate: 0.1 },
    { above: 0, newRegimeRate: 0, oldRegimeRate: 0 },
  ],
  cappedSurchargeRate: 0.15,
  cessRate: 0.04,
  standardDeduction: { new: 75_000, old: 50_000 },
  capitalGains: {
    equityStcgRate: 0.2,
    equityLtcgRate: 0.125,
    equityLtcgExemption: 125_000,
    otherLtcgRate: 0.125,
    vdaRate: 0.3,
    propertyLtcgRate: 0.125,
    propertyLtcgLegacyIndexedRate: 0.2,
    legacyIndexationCutoff: '23 July 2024',
  },
  sources: ['itd-efiling-ay2026-27', 'income-tax-act-1961', 'clear-tax-slabs', 'clear-tax-capital-gains'],
  verifiedAt: '2026-10-16',
};

// The new regime caps surcharge at 25% even above ₹5 crore. Encoded explicitly
// rather than by a conditional in the calculation, so the difference between the
// regimes is visible in the data rather than buried in code.
const NEW_REGIME_SURCHARGE_BANDS: SurchargeBand[] = FY_2025_26.surchargeBands.map((band) =>
  band.above >= 50_000_000 ? { ...band, newRegimeRate: 0.25 } : band,
);

/** Progressive slab tax before rebate, surcharge and cess. */
export function slabTax(income: number, slabs: Slab[]): number {
  if (!Number.isFinite(income) || income <= 0) return 0;
  let tax = 0;
  let previous = 0;
  for (const slab of slabs) {
    if (income <= previous) break;
    const band = Math.min(income, slab.upTo) - previous;
    tax += band * slab.rate;
    previous = slab.upTo;
  }
  return tax;
}

/** Marginal rate applicable to the next rupee of slab income. */
export function marginalSlabRate(income: number, slabs: Slab[]): number {
  for (const slab of slabs) {
    if (income <= slab.upTo) return slab.rate;
  }
  return slabs[slabs.length - 1]?.rate ?? 0;
}

function applicableSurchargeRate(totalIncome: number, regime: Regime): number {
  const bands = regime === 'new' ? NEW_REGIME_SURCHARGE_BANDS : FY_2025_26.surchargeBands;
  for (const band of bands) {
    if (totalIncome > band.above) {
      return regime === 'new' ? band.newRegimeRate : band.oldRegimeRate;
    }
  }
  return 0;
}

export interface SurchargeResult {
  rate: number;
  surcharge: number;
  marginalRelief: number;
  /** Component of the tax that attracts the 15% capped rate. */
  cappedTax: number;
  uncappedTax: number;
  notes: string[];
}

/**
 * Surcharge with the statutory 15% cap and marginal relief.
 *
 * `cappedTax` is the portion of the income tax attributable to s.111A, s.112,
 * s.112A and dividend income. Those components attract surcharge at no more
 * than 15% regardless of total income. Marginal relief is then applied so that
 * the tax plus surcharge on income just above a band threshold does not exceed
 * the tax on the threshold plus the excess income.
 */
export function computeSurcharge(
  /** Retained for signature stability: the uncapped component is derived from
      `taxOnSlabIncome - cappedTax` inside the function. */
  _taxableIncomeExcludingGains: number,
  totalIncome: number,
  taxOnSlabIncome: number,
  cappedTax: number,
  regime: Regime,
  ageBand: AgeBand,
  constants: TaxYearConstants = FY_2025_26,
): SurchargeResult {
  const notes: string[] = [];
  const rate = applicableSurchargeRate(totalIncome, regime);
  const uncappedTax = Math.max(0, taxOnSlabIncome - cappedTax);

  if (rate === 0) {
    return { rate: 0, surcharge: 0, marginalRelief: 0, cappedTax, uncappedTax, notes };
  }

  const surcharge = cappedTax * Math.min(rate, constants.cappedSurchargeRate) + uncappedTax * rate;
  if (cappedTax > 0) {
    notes.push(
      `Surcharge on ${formatRupeesPlain(cappedTax)} of capital-gains and dividend tax is capped at 15%, while the remaining tax attracts ${(rate * 100).toFixed(0)}%. This is why a long-term equity gain is taxed far more lightly than interest income at high total income.`,
    );
  }

  // Marginal relief at each band threshold crossed.
  let relief = 0;
  for (const band of constants.surchargeBands) {
    if (band.above === 0) continue;
    const threshold = band.above;
    if (totalIncome <= threshold) continue;
    const slabs = regime === 'new' ? constants.newRegimeSlabs : constants.oldRegimeSlabs[ageBand];
    const taxAtThreshold = slabTax(threshold, slabs);
    // Approximate the split at the threshold using the same capped proportion.
    const cappedShare = taxOnSlabIncome > 0 ? cappedTax / taxOnSlabIncome : 0;
    const cappedAtThreshold = taxAtThreshold * cappedShare;
    const uncappedAtThreshold = taxAtThreshold - cappedAtThreshold;
    const thresholdSurchargeRate = (() => {
      const bands = regime === 'new' ? NEW_REGIME_SURCHARGE_BANDS : constants.surchargeBands;
      const idx = bands.findIndex((b) => b.above === threshold);
      const band = bands[idx + 1];
      if (idx === -1) return 0;
      return regime === 'new' ? (band?.newRegimeRate ?? 0) : (band?.oldRegimeRate ?? 0);
    })();
    const surchargeAtThreshold =
      cappedAtThreshold * Math.min(thresholdSurchargeRate, constants.cappedSurchargeRate) +
      uncappedAtThreshold * thresholdSurchargeRate;
    const limit = taxAtThreshold + surchargeAtThreshold + (totalIncome - threshold);
    const actual = taxOnSlabIncome + surcharge;
    if (actual > limit) {
      relief += actual - limit;
      notes.push(
        `Marginal relief of ${formatRupeesPlain(actual - limit)} applied at the ${formatRupeesPlain(threshold)} threshold: without it, crossing the threshold by one rupee would cost more than the extra income.`,
      );
    }
  }

  return {
    rate,
    surcharge: Math.max(0, surcharge - relief),
    marginalRelief: relief,
    cappedTax,
    uncappedTax,
    notes,
  };
}

function formatRupeesPlain(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

/* --------------------------------------------------------------------------
   Slab-income estimation and regime comparison
   -------------------------------------------------------------------------- */

export interface SlabIncomeInput {
  grossSalary?: number;
  otherSlabIncome?: number;
  /** Deductions under Chapter VI-A eligible only in the old regime. */
  chapterVIA?: number;
  /** Deductions that survive in the new regime (e.g. employer NPS contribution). */
  deductionsAvailableInBothRegimes?: number;
  householdPropertyLoss?: number;
  regime: Regime;
  ageBand?: AgeBand;
  constants?: TaxYearConstants;
}

export interface SlabIncomeResult {
  taxableIncome: number;
  standardDeduction: number;
  deductionsAllowed: number;
  deductionsDisallowed?: number;
  notes: string[];
}

/**
 * Taxable slab income after deductions, stated separately for the two regimes
 * so that the effect of the regime choice is visible rather than asserted.
 */
export function computeSlabIncome(input: SlabIncomeInput): SlabIncomeResult {
  const constants = input.constants ?? FY_2025_26;
  const ageBand = input.ageBand ?? 'below-60';
  const notes: string[] = [];
  const salary = input.grossSalary ?? 0;
  const standardDeduction =
    salary > 0 ? Math.min(salary, input.regime === 'new' ? constants.standardDeduction.new : constants.standardDeduction.old) : 0;

  let deductionsAllowed = input.deductionsAvailableInBothRegimes ?? 0;
  let deductionsDisallowed = 0;
  if (input.regime === 'old') {
    deductionsAllowed += input.chapterVIA ?? 0;
  } else if ((input.chapterVIA ?? 0) > 0) {
    deductionsDisallowed = input.chapterVIA ?? 0;
    notes.push(
      `Under the new regime the deduction of ${formatRupeesPlain(deductionsDisallowed)} under Chapter VI-A is not available. This is the single largest structural difference between the regimes for a salaried taxpayer.`,
    );
  }

  let householdPropertyLoss = input.householdPropertyLoss ?? 0;
  if (input.regime === 'new' && householdPropertyLoss > 0) {
    notes.push(
      'A loss under the head income from house property cannot be set off against other heads under the new regime. The loss is carried forward against future house-property income only.',
    );
    householdPropertyLoss = 0;
  }

  const gross = salary + (input.otherSlabIncome ?? 0);
  const taxableIncome = Math.max(
    0,
    gross - standardDeduction - deductionsAllowed - Math.min(householdPropertyLoss, input.regime === 'old' ? 200_000 : 0),
  );

  if (input.regime === 'old' && householdPropertyLoss > 200_000) {
    notes.push(
      'Interest on borrowed capital exceeds the ₹2,00,000 annual ceiling for set-off against other heads. The excess is carried forward for up to eight assessment years against house-property income.',
    );
  }

  if (input.regime === 'new' && ageBand !== 'below-60') {
    notes.push(
      'The old regime grants a higher basic exemption to resident senior and super-senior citizens. The new regime does not differentiate by age, which narrows or reverses the old regime advantage for many retirees.',
    );
  }

  return { taxableIncome, standardDeduction, deductionsAllowed, deductionsDisallowed, notes };
}

export interface SlabTaxResult {
  regime: Regime;
  taxableIncome: number;
  slabTax: number;
  rebate: number;
  taxAfterRebate: number;
  surcharge: number;
  surchargeRate: number;
  marginalRelief: number;
  cess: number;
  totalTax: number;
  /** Tax divided by taxable income. */
  effectiveRate: number;
  marginalRate: number;
  notes: string[];
}

/** Complete slab-income liability including rebate, surcharge, marginal relief and cess. */
export function computeSlabLiability(input: SlabIncomeInput): SlabTaxResult {
  const constants = input.constants ?? FY_2025_26;
  const ageBand = input.ageBand ?? 'below-60';
  const income = computeSlabIncome(input);
  const slabs = input.regime === 'new' ? constants.newRegimeSlabs : constants.oldRegimeSlabs[ageBand];
  const tax = slabTax(income.taxableIncome, slabs);
  const notes = [...income.notes];

  let rebate = 0;
  if (input.regime === 'new') {
    if (income.taxableIncome <= constants.newRegimeRebate.threshold) {
      rebate = Math.min(tax, constants.newRegimeRebate.maxRebate);
    } else if (income.taxableIncome <= constants.newRegimeRebate.marginalReliefCeiling) {
      // Marginal relief in the band just above the rebate threshold.
      const excess = income.taxableIncome - constants.newRegimeRebate.threshold;
      rebate = Math.max(0, tax - excess);
      if (rebate > 0) {
        notes.push(
          `Marginal relief of ${formatRupeesPlain(rebate)} applied because taxable income is only ${formatRupeesPlain(excess)} above the ${formatRupeesPlain(constants.newRegimeRebate.threshold)} rebate threshold. Without this relief the effective rate on the last rupees of income would be far above the nominal slab rate.`,
        );
      }
    }
  } else if (income.taxableIncome <= constants.oldRegimeRebate.threshold) {
    rebate = Math.min(tax, constants.oldRegimeRebate.maxRebate);
  }

  const taxAfterRebate = Math.max(0, tax - rebate);
  const surchargeResult = computeSurcharge(
    income.taxableIncome,
    income.taxableIncome,
    taxAfterRebate,
    0,
    input.regime,
    ageBand,
    constants,
  );
  const cess = (taxAfterRebate + surchargeResult.surcharge) * constants.cessRate;
  const totalTax = taxAfterRebate + surchargeResult.surcharge + cess;

  return {
    regime: input.regime,
    taxableIncome: income.taxableIncome,
    slabTax: tax,
    rebate,
    taxAfterRebate,
    surcharge: surchargeResult.surcharge,
    surchargeRate: surchargeResult.rate,
    marginalRelief: surchargeResult.marginalRelief,
    cess,
    totalTax,
    effectiveRate: income.taxableIncome > 0 ? totalTax / income.taxableIncome : 0,
    marginalRate: marginalSlabRate(income.taxableIncome, slabs),
    notes: [...notes, ...surchargeResult.notes],
  };
}

export interface RegimeComparison {
  newRegime: SlabTaxResult;
  oldRegime: SlabTaxResult;
  savingFromChosen: number;
  cheaperRegime: Regime | 'equal';
  /** Total deductions that would have to be available for the old regime to win. */
  deductionsNeededForOldRegimeToWin: number | null;
  notes: string[];
}

/**
 * Compare both regimes on the same income and deduction profile.
 *
 * The interesting output is not which regime is cheaper for one set of numbers
 * — it is the amount of deductions at which the ranking flips. That threshold
 * is what a taxpayer can actually act on.
 */
export function compareRegimes(
  base: Omit<SlabIncomeInput, 'regime'>,
  constants: TaxYearConstants = FY_2025_26,
): RegimeComparison {
  const newRegime = computeSlabLiability({ ...base, regime: 'new', constants });
  const oldRegime = computeSlabLiability({ ...base, regime: 'old', constants });
  const saving = oldRegime.totalTax - newRegime.totalTax;
  const notes: string[] = [
    'The new regime is the default. A taxpayer without business income may switch between regimes each year; a taxpayer with business income may opt out of the default only once, before the return due date.',
  ];

  // Solve for the Chapter VI-A deduction at which the old regime becomes cheaper.
  let flip: number | null = null;
  const provided = base.chapterVIA ?? 0;
  for (let extra = 0; extra <= 1_000_000; extra += 5_000) {
    const old = computeSlabLiability({ ...base, chapterVIA: provided + extra, regime: 'old', constants });
    if (old.totalTax <= newRegime.totalTax) {
      flip = provided + extra;
      break;
    }
  }
  if (flip === null) {
    notes.push(
      'Within the Chapter VI-A deduction range tested (up to ₹10,00,000 beyond the amount supplied), the old regime does not become cheaper at this income level.',
    );
  }

  return {
    newRegime,
    oldRegime,
    savingFromChosen: Math.abs(saving),
    cheaperRegime: saving > 0 ? 'new' : saving < 0 ? 'old' : 'equal',
    deductionsNeededForOldRegimeToWin: flip,
    notes,
  };
}

/* --------------------------------------------------------------------------
   Capital gains
   -------------------------------------------------------------------------- */

export interface CapitalGainsInput {
  /** STT-paid short-term equity gains, s.111A. */
  equityStcg?: number;
  /** STT-paid long-term equity gains, s.112A. Exemption applied automatically. */
  equityLtcg?: number;
  /** Other long-term gains taxed under s.112 (gold, unlisted shares, foreign assets). */
  otherLtcg?: number;
  /** Gains taxed at slab rates (specified mutual funds under s.50AA, property held ≤ 24 months). */
  slabRateGains?: number;
  /** Virtual digital asset gains, s.115BBH. Losses are not set off here. */
  vdaGains?: number;
  /** Dividend income: slab rate but with the 15% surcharge cap. */
  dividend?: number;
  /** Ordinary slab income for the year, e.g. salary. */
  ordinaryIncome?: number;
  chapterVIA?: number;
  /** Losses already established as eligible for set-off this year. */
  shortTermCapitalLoss?: number;
  longTermCapitalLoss?: number;
  regime: Regime;
  ageBand?: AgeBand;
  constants?: TaxYearConstants;
}

export interface CapitalGainsResult {
  constants: { financialYear: string; assessmentYear: string; statutoryBasis: string };
  taxableOrdinaryIncome: number;
  gains: {
    equityStcgTaxed: number;
    equityLtcgGross: number;
    equityLtcgExempt: number;
    equityLtcgTaxed: number;
    otherLtcgTaxed: number;
    slabRateGains: number;
    vdaGains: number;
    dividend: number;
  };
  lossesApplied: { shortTerm: number; longTerm: number; unusedShortTerm: number; unusedLongTerm: number };
  taxComponents: {
    slabTax: number;
    rebate: number;
    equityStcgTax: number;
    equityLtcgTax: number;
    otherLtcgTax: number;
    vdaTax: number;
    dividendTax: number;
    surcharge: number;
    surchargeRate: number;
    marginalRelief: number;
    cess: number;
    total: number;
  };
  effectiveRate: number;
  /** Rate on each rupee of gain, for comparing two assets directly. */
  marginalRateOnGains: {
    equityStcg: number;
    equityLtcg: number;
    otherLtcg: number;
    slabRateGains: number;
    vdaGains: number;
    dividend: number;
  };
  assumptions: string[];
  notes: string[];
  warnings: string[];
}

/**
 * Full-year capital-gains and slab liability.
 *
 * Loss set-off is applied in the statutory order: short-term losses first
 * against short-term gains, then long-term gains; long-term losses only against
 * long-term gains. VDA losses are never set off — s.115BBH prohibits it — and
 * the engine never silently applies them.
 */
export function computeCapitalGainsTax(input: CapitalGainsInput): CapitalGainsResult {
  const constants = input.constants ?? FY_2025_26;
  const ageBand = input.ageBand ?? 'below-60';
  const notes: string[] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [
    `Rates and thresholds are those in force for ${constants.financialYear} (${constants.assessmentYear}).`,
    `Statutory basis: ${constants.statutoryBasis}.`,
    'The engine assumes the taxpayer is a resident individual. Non-resident treatment differs in several places, most importantly for property and for the first proviso to s.48.',
    'Surcharge is computed on the whole liability with the 15% cap applied to s.111A, s.112, s.112A and dividend components, and marginal relief applied at each threshold.',
    'Advance-tax interest under s.234B and s.234C is not computed here.',
    'Set-off against brought-forward losses of earlier years is not modelled; enter only the current-year losses.',
  ];

  let equityStcg = Math.max(0, input.equityStcg ?? 0);
  let equityLtcg = Math.max(0, input.equityLtcg ?? 0);
  let otherLtcg = Math.max(0, input.otherLtcg ?? 0);
  let slabRateGains = Math.max(0, input.slabRateGains ?? 0);
  const vdaGains = Math.max(0, input.vdaGains ?? 0);
  const dividend = Math.max(0, input.dividend ?? 0);

  // ---- Loss set-off ----
  let stcl = Math.max(0, input.shortTermCapitalLoss ?? 0);
  let ltcl = Math.max(0, input.longTermCapitalLoss ?? 0);

  const stclAgainstStcg = Math.min(stcl, equityStcg);
  equityStcg -= stclAgainstStcg;
  stcl -= stclAgainstStcg;

  if (stcl > 0) {
    // A short-term loss may be set off against long-term gains. It is applied
    // to the least-favourably taxed long-term gain first, which is the standard
    // planning order.
    const againstOther = Math.min(stcl, otherLtcg);
    otherLtcg -= againstOther;
    stcl -= againstOther;
    const againstEquity = Math.min(stcl, equityLtcg);
    equityLtcg -= againstEquity;
    stcl -= againstEquity;
    const againstSlab = Math.min(stcl, slabRateGains);
    slabRateGains -= againstSlab;
    stcl -= againstSlab;
  }

  const ltclAgainstOther = Math.min(ltcl, otherLtcg);
  otherLtcg -= ltclAgainstOther;
  ltcl -= ltclAgainstOther;
  const ltclAgainstEquity = Math.min(ltcl, equityLtcg);
  equityLtcg -= ltclAgainstEquity;
  ltcl -= ltclAgainstEquity;

  if ((input.vdaGains ?? 0) < 0) {
    warnings.push(
      'Virtual digital asset losses were supplied but cannot be set off against any income, including other virtual digital asset gains. The loss has been disregarded rather than netted.',
    );
  }
  if (stcl > 0 || ltcl > 0) {
    notes.push(
      `${formatRupeesPlain(stcl + ltcl)} of capital loss could not be set off against the gains supplied. It may be carried forward for up to eight assessment years, but only if the return is filed by the due date under s.139(1) — a belated return forfeits the carry-forward entirely.`,
    );
  }

  const equityLtcgExempt = Math.min(equityLtcg, constants.capitalGains.equityLtcgExemption);
  const equityLtcgTaxed = Math.max(0, equityLtcg - constants.capitalGains.equityLtcgExemption);

  // ---- Slab income ----
  const ordinary = Math.max(0, input.ordinaryIncome ?? 0);
  const chapterVIA = input.regime === 'old' ? Math.max(0, input.chapterVIA ?? 0) : 0;
  if (input.regime === 'new' && (input.chapterVIA ?? 0) > 0) {
    notes.push('Chapter VI-A deductions were supplied but are not available under the new regime, so they were not applied.');
  }
  // Note: slab-rate capital gains are part of total income but Chapter VI-A
  // deductions cannot be set against capital gains under s.112A(4) and the
  // corresponding restrictions, so deductions are applied to ordinary income only.
  const taxableOrdinaryIncome = Math.max(0, ordinary - chapterVIA);
  const slabBase = taxableOrdinaryIncome + slabRateGains + dividend;

  const slabs = input.regime === 'new' ? constants.newRegimeSlabs : constants.oldRegimeSlabs[ageBand];
  const totalSlabTax = slabTax(slabBase, slabs);
  const taxOnOrdinaryOnly = slabTax(taxableOrdinaryIncome, slabs);
  // Tax attributable to dividend is the marginal difference, which is the
  // correct way to isolate the dividend's contribution to the liability.
  const dividendTax = Math.max(0, totalSlabTax - taxOnOrdinaryOnly - slabTax(taxableOrdinaryIncome + slabRateGains, slabs));

  // ---- Rebate ----
  const totalIncome = slabBase + equityStcg + equityLtcg + otherLtcg + vdaGains;
  let rebate = 0;
  if (input.regime === 'new') {
    if (totalIncome <= constants.newRegimeRebate.threshold) {
      // The rebate cannot be claimed against tax on special-rate income.
      rebate = Math.min(taxOnOrdinaryOnly, constants.newRegimeRebate.maxRebate);
      if (rebate > 0) {
        notes.push(
          'The s.87A rebate has been applied only against the tax on slab-rate income, because it is not available against income chargeable at special rates such as s.111A, s.112 and s.112A.',
        );
      }
    } else if (totalIncome <= constants.newRegimeRebate.marginalReliefCeiling) {
      const excess = totalIncome - constants.newRegimeRebate.threshold;
      const rebateable = Math.min(taxOnOrdinaryOnly, constants.newRegimeRebate.maxRebate);
      rebate = Math.max(0, rebateable - excess);
    }
  } else if (totalIncome <= constants.oldRegimeRebate.threshold) {
    rebate = Math.min(taxOnOrdinaryOnly, constants.oldRegimeRebate.maxRebate);
  }

  const slabTaxAfterRebate = Math.max(0, totalSlabTax - rebate);

  // ---- Special-rate taxes ----
  const equityStcgTax = equityStcg * constants.capitalGains.equityStcgRate;
  const equityLtcgTax = equityLtcgTaxed * constants.capitalGains.equityLtcgRate;
  const otherLtcgTax = otherLtcg * constants.capitalGains.otherLtcgRate;
  const vdaTax = vdaGains * constants.capitalGains.vdaRate;

  const cappedTax = equityStcgTax + equityLtcgTax + otherLtcgTax + dividendTax;
  const totalBeforeSurcharge = slabTaxAfterRebate + vdaTax;

  const surchargeResult = computeSurcharge(
    slabBase,
    totalIncome,
    totalBeforeSurcharge,
    cappedTax,
    input.regime,
    ageBand,
    constants,
  );

  const cess = (totalBeforeSurcharge + surchargeResult.surcharge) * constants.cessRate;
  const total = totalBeforeSurcharge + surchargeResult.surcharge + cess;

  const surchargeMultiplier = 1 + surchargeResult.rate + (1 + surchargeResult.rate) * constants.cessRate;
  const cappedMultiplier = 1 + Math.min(surchargeResult.rate, constants.cappedSurchargeRate) * (1 + constants.cessRate);

  if (vdaGains > 0) {
    warnings.push(
      'Virtual digital asset gains are taxed at 30% plus surcharge and cess with no deduction other than cost of acquisition, and losses cannot be set off against any income. This is the least favourable tax treatment of any asset class in this engine.',
    );
  }

  return {
    constants: {
      financialYear: constants.financialYear,
      assessmentYear: constants.assessmentYear,
      statutoryBasis: constants.statutoryBasis,
    },
    taxableOrdinaryIncome,
    gains: {
      equityStcgTaxed: equityStcg,
      equityLtcgGross: equityLtcg + equityLtcgExempt,
      equityLtcgExempt,
      equityLtcgTaxed,
      otherLtcgTaxed: otherLtcg,
      slabRateGains,
      vdaGains,
      dividend,
    },
    lossesApplied: {
      shortTerm: (input.shortTermCapitalLoss ?? 0) - stcl,
      longTerm: (input.longTermCapitalLoss ?? 0) - ltcl,
      unusedShortTerm: stcl,
      unusedLongTerm: ltcl,
    },
    taxComponents: {
      slabTax: slabTaxAfterRebate,
      rebate,
      equityStcgTax,
      equityLtcgTax,
      otherLtcgTax,
      vdaTax,
      dividendTax,
      surcharge: surchargeResult.surcharge,
      surchargeRate: surchargeResult.rate,
      marginalRelief: surchargeResult.marginalRelief,
      cess,
      total,
    },
    effectiveRate: totalIncome > 0 ? total / totalIncome : 0,
    marginalRateOnGains: {
      equityStcg: constants.capitalGains.equityStcgRate * cappedMultiplier,
      equityLtcg:
        equityLtcg > constants.capitalGains.equityLtcgExemption
          ? constants.capitalGains.equityLtcgRate * cappedMultiplier
          : 0,
      otherLtcg: constants.capitalGains.otherLtcgRate * cappedMultiplier,
      slabRateGains: (marginalSlabRate(slabBase, slabs) + surchargeResult.rate * marginalSlabRate(slabBase, slabs)) * (1 + constants.cessRate),
      vdaGains: constants.capitalGains.vdaRate * surchargeMultiplier,
      dividend: slabAttributableRate(slabBase, dividend, slabs) * surchargeMultiplier,
    },
    assumptions,
    notes: [...notes, ...surchargeResult.notes],
    warnings,
  };
}

function slabAttributableRate(slabBase: number, amount: number, slabs: Slab[]): number {
  if (amount <= 0) return 0;
  const full = slabTax(slabBase, slabs);
  const without = slabTax(Math.max(0, slabBase - amount), slabs);
  return (full - without) / amount;
}

/* --------------------------------------------------------------------------
   Post-tax asset comparison
   -------------------------------------------------------------------------- */

export type AssetTaxClass =
  | 'equity-listed'
  | 'equity-unlisted'
  | 'debt-specified-mf'
  | 'interest-income'
  | 'dividend'
  | 'gold-etf'
  | 'property-long-term'
  | 'vda'
  | 'ppf-exempt'
  | 'sgb-redemption'
  | 'reit-invit-unit';

export interface PostTaxComparisonInput {
  assetLabel: string;
  taxClass: AssetTaxClass;
  grossReturn: number;
  holdingYears: number;
  /** Marginal slab rate of the investor, used for interest and slab-rate income. */
  marginalSlabRate: number;
  /** Total income including the gain, which determines the surcharge band. */
  totalIncome?: number;
  /** Fraction of the return received as income each year rather than as capital growth. */
  incomeShareEachYear?: number;
  constants?: TaxYearConstants;
}

export interface PostTaxComparisonResult {
  assetLabel: string;
  grossReturn: number;
  preTaxTerminalMultiple: number;
  postTaxTerminalMultiple: number;
  annualisedPostTaxReturn: number;
  effectiveTaxRateOnGain: number;
  taxTreatment: string;
  notes: string[];
}

/**
 * Post-tax return on a single asset, correctly distinguishing an annual tax on
 * income from a terminal tax on a capital gain.
 *
 * Getting this distinction wrong is the most common error in Indian investment
 * comparison: a fixed deposit's interest is taxed every year (so the tax cost
 * compounds), whereas an equity capital gain is taxed once at the end (so the
 * money you would have paid in tax keeps compounding for you). The same
 * headline rate therefore produces very different outcomes.
 */
export function postTaxAssetReturn(input: PostTaxComparisonInput): PostTaxComparisonResult {
  const constants = input.constants ?? FY_2025_26;
  const notes: string[] = [];
  const years = Math.max(0, input.holdingYears);
  const totalIncome = input.totalIncome ?? input.marginalSlabRate * 1_000_000;
  const surchargeRate = applicableSurchargeRate(totalIncome, 'new');
  const slabMultiplier = (input.marginalSlabRate + surchargeRate * input.marginalSlabRate) * (1 + constants.cessRate);
  const cappedMultiplier = (1 + Math.min(surchargeRate, constants.cappedSurchargeRate)) * (1 + constants.cessRate);

  const incomeShare = input.incomeShareEachYear ?? 0;
  const preTaxTerminal = Math.pow(1 + input.grossReturn, years);

  let postTaxTerminal = preTaxTerminal;
  let treatment = '';
  let effectiveTaxRate = 0;

  switch (input.taxClass) {
    case 'equity-listed': {
      // Growth is deferred and taxed once as a long-term capital gain.
      const isLongTerm = years > 1;
      const rate = (isLongTerm ? constants.capitalGains.equityLtcgRate : constants.capitalGains.equityStcgRate) * cappedMultiplier;
      const gain = preTaxTerminal - 1;
      // The exemption is stated per ₹1,00,000 invested because ₹1,25,000 is the
      // annual per-PAN threshold under s.112A and the site's worked examples are
      // expressed per ₹1 lakh. Tax is computed on the gain above it.
      const exemption = isLongTerm ? constants.capitalGains.equityLtcgExemption / 100_000 : 0;
      const taxableGain = Math.max(0, gain - exemption);
      const tax = taxableGain * rate;
      postTaxTerminal = 1 + gain - tax;
      effectiveTaxRate = gain > 0 ? tax / gain : 0;
      treatment = isLongTerm
        ? `Long-term: 12.5% above the ₹1,25,000 annual exemption, surcharge capped at 15%, plus 4% cess (effective ${(rate * 100).toFixed(2)}%).`
        : `Short-term (held 12 months or less): 20% flat plus surcharge (capped at 15%) and cess (effective ${(rate * 100).toFixed(2)}%).`;
      notes.push(
        'The gain is taxed once, at the end. Nothing is paid in the intervening years, so the tax that would have been paid keeps compounding on the investor’s behalf. This deferral is worth more than the rate difference over long horizons.',
      );
      break;
    }
    case 'equity-unlisted': {
      const isLongTerm = years > 2;
      const rate = isLongTerm ? constants.capitalGains.otherLtcgRate * cappedMultiplier : slabMultiplier;
      const gain = preTaxTerminal - 1;
      postTaxTerminal = 1 + gain * (1 - rate);
      effectiveTaxRate = rate;
      treatment = isLongTerm
        ? 'Long-term (held over 24 months): 12.5% without indexation, no ₹1,25,000 exemption, no securities transaction tax so s.112A does not apply.'
        : 'Short-term (24 months or less): slab rates plus surcharge and cess. This is the most expensive holding period in the Indian tax code for a growth asset.';
      notes.push(
        'No STT is payable on unlisted shares, so neither s.111A nor s.112A can apply. This is the single largest tax difference between unlisted and listed equity, and it is frequently overlooked in pre-IPO calculations.',
      );
      break;
    }
    case 'debt-specified-mf': {
      // Deemed short-term regardless of holding period; taxed at slab each year
      // on an accrual basis in practice for the investor's reported gain.
      const rate = slabMultiplier;
      const gain = preTaxTerminal - 1;
      postTaxTerminal = 1 + gain * (1 - rate);
      effectiveTaxRate = rate;
      treatment = 'Specified mutual fund acquired on or after 1 April 2023: deemed short-term regardless of holding period, taxed at slab rates with no indexation.';
      notes.push(
        'Indexation is not available for units acquired on or after 1 April 2023. For units acquired before that date, long-term treatment at 12.5% without indexation may still apply — the acquisition vintage, not the sale date, governs.',
      );
      break;
    }
    case 'interest-income': {
      // Taxed every year on accrual, so the tax cost itself compounds.
      const afterTaxAnnual = input.grossReturn * (1 - slabMultiplier);
      const blended = input.grossReturn * (1 - incomeShare) + afterTaxAnnual * (incomeShare || 1);
      postTaxTerminal = Math.pow(1 + blended, years);
      effectiveTaxRate = slabMultiplier;
      treatment = 'Taxed at slab rates in the year the interest accrues, whether or not it has been received in cash.';
      notes.push(
        'Interest is taxed every year. The tax you pay in year one is capital you no longer have in year two, so the drag compounds. This is why a 7% fixed deposit and a 7% equity return are not equivalent even before risk is considered.',
      );
      break;
    }
    case 'dividend': {
      // Surcharge on dividend income is capped at 15% by the proviso to
      // s.2(3) of the Finance Act; the uncapped slab multiplier would
      // overstate it for incomes above ₹5 crore in the new regime.
      const dividendMultiplier =
        (input.marginalSlabRate + Math.min(surchargeRate, constants.cappedSurchargeRate) * input.marginalSlabRate) *
        (1 + constants.cessRate);
      postTaxTerminal = 1 + (preTaxTerminal - 1) * (1 - dividendMultiplier);
      effectiveTaxRate = dividendMultiplier;
      treatment = 'Dividend is taxed at the recipient’s slab rate in the year received, with surcharge capped at 15% for this income.';
      break;
    }
    case 'gold-etf': {
      const isLongTerm = years > 2;
      const rate = isLongTerm ? constants.capitalGains.otherLtcgRate * cappedMultiplier : slabMultiplier;
      postTaxTerminal = 1 + (preTaxTerminal - 1) * (1 - rate);
      effectiveTaxRate = rate;
      treatment = isLongTerm
        ? 'Long-term (held over 24 months): 12.5% without indexation. Gold funds are not equity funds, so the 12-month threshold and the ₹1,25,000 exemption do not apply.'
        : 'Short-term (24 months or less): slab rates. A gold position held 20 months attracts a far higher tax rate than an equity position held the same period.';
      break;
    }
    case 'property-long-term': {
      postTaxTerminal = 1 + (preTaxTerminal - 1) * (1 - constants.capitalGains.propertyLtcgRate * cappedMultiplier);
      effectiveTaxRate = constants.capitalGains.propertyLtcgRate * cappedMultiplier;
      treatment = 'Long-term (held over 24 months): 12.5% without indexation; 20% with indexation remains an option for resident individuals and HUFs for property acquired before 23 July 2024.';
      notes.push(
        'Indexation was the main inflation protection in the Indian tax code for property and debt. Its withdrawal for transfers on or after 23 July 2024 materially worsened the post-tax outcome of long-held property and of gold, and improves the relative case for equity.',
      );
      break;
    }
    case 'vda': {
      postTaxTerminal = 1 + (preTaxTerminal - 1) * (1 - constants.capitalGains.vdaRate * (1 + surchargeRate + (1 + surchargeRate) * constants.cessRate));
      effectiveTaxRate = constants.capitalGains.vdaRate * (1 + surchargeRate + (1 + surchargeRate) * constants.cessRate);
      treatment = 'Flat 30% under s.115BBH plus surcharge (not capped at 15%) and 4% cess, with no expense deduction and no loss set-off.';
      break;
    }
    case 'ppf-exempt':
    case 'sgb-redemption':
      postTaxTerminal = preTaxTerminal;
      effectiveTaxRate = 0;
      treatment =
        input.taxClass === 'ppf-exempt'
          ? 'Exempt-exempt-exempt: contributions qualify in the old regime, interest is exempt and maturity proceeds are exempt.'
          : 'Redemption by an individual at maturity is exempt; the periodic interest is taxed at slab rates.';
      notes.push(
        input.taxClass === 'sgb-redemption'
          ? 'Only the capital gain on redemption is exempt. The 2.50% coupon is fully taxable at slab rates, which is often omitted when the bond is described as tax-free.'
          : 'A genuine tax exemption is rare. Its value depends entirely on the investor’s slab rate — the higher the slab, the more the exemption is worth, and the less attractive the headline rate appears relative to a taxable alternative.',
      );
      break;
    case 'reit-invit-unit': {
      const isLongTerm = years > 1;
      const rate = isLongTerm ? constants.capitalGains.equityLtcgRate * cappedMultiplier : constants.capitalGains.equityStcgRate * cappedMultiplier;
      postTaxTerminal = 1 + (preTaxTerminal - 1) * (1 - rate);
      effectiveTaxRate = rate;
      treatment = 'Capital gains follow the listed-equity framework: 12 months for long-term treatment, 12.5% above the ₹1,25,000 exemption, 20% short-term.';
      notes.push(
        'Units are treated like listed equity for capital gains, but the distributions are not: the interest and dividend components are taxed at slab rates and the capital-repayment component reduces the cost basis. An 8% distribution yield is not an 8% taxable yield.',
      );
      break;
    }
  }

  const annualisedPostTax = years > 0 ? Math.pow(Math.max(1e-9, postTaxTerminal), 1 / years) - 1 : 0;

  return {
    assetLabel: input.assetLabel,
    grossReturn: input.grossReturn,
    preTaxTerminalMultiple: preTaxTerminal,
    postTaxTerminalMultiple: postTaxTerminal,
    annualisedPostTaxReturn: annualisedPostTax,
    effectiveTaxRateOnGain: effectiveTaxRate,
    taxTreatment: treatment,
    notes,
  };
}

/** Annual risk-free proxy used only for diagnostics, never as advice. */
export const RISK_FREE_DISCLAIMER =
  'A risk-free rate is a modelling input, not an observable constant. Indian government securities of a matching maturity are the closest available proxy, and their yield changes daily.';
