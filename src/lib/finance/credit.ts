/**
 * Peer-to-peer lending portfolio analytics.
 *
 * The central fact this module exists to make unavoidable: a P2P platform's
 * reported return is a claim about interest that has been *booked*, not about
 * cash that has been *received*. On a portfolio with defaults, those two
 * numbers can differ by more than the entire spread over a fixed deposit.
 * Every function here therefore separates accrued interest from realised cash.
 */

import { xirr, type CashFlow } from './returns';

export type LoanStatus = 'current' | 'delinquent' | 'defaulted' | 'written-off' | 'closed';

export interface P2PLoan {
  id: string;
  borrowerId: string;
  /** Principal disbursed to the borrower, net of platform fees already deducted. */
  principal: number;
  /** Contractual annual interest rate as a fraction, e.g. 0.14 for 14% p.a. */
  annualRate: number;
  tenureMonths: number;
  disbursementDate: Date;
  /** Principal returned to the investor so far, excluding recovered defaulted principal. */
  principalRepaid: number;
  /** Interest actually received in cash. */
  interestReceived: number;
  /** Interest credited or accrued but not yet received in cash. */
  interestAccruedUnreceived: number;
  /** Platform and servicing fees borne by the investor on this loan. */
  feesPaid: number;
  /** Amount of contractual payments past due. */
  amountOverdue: number;
  status: LoanStatus;
  /** Cash recovered after the loan entered default. */
  recoveriesReceived?: number;
  /** Principal formally written off. */
  writeOffPrincipal?: number;
  riskGrade?: string;
  /** Original borrower credit band supplied by the platform, if any. */
  platformGrade?: string;
}

export interface P2PConcentration {
  /** Share of total principal attributable to the largest single borrower. */
  largestBorrowerShare: number;
  /** Herfindahl–Hirschman index on borrower shares: 1 = one borrower. */
  hhi: number;
  /** Number of distinct borrowers. */
  borrowerCount: number;
  /** The smallest number of borrowers responsible for half the principal. */
  borrowersForHalf: number;
  /** Shares of the ten largest borrowers. */
  topShares: number[];
}

export interface P2PPortfolioMetrics {
  loanCount: number;
  totalLent: number;
  feesPaid: number;
  /** Principal returned in the ordinary course. */
  principalRepaid: number;
  /** Principal that has not yet been repaid and is not written off. */
  principalOutstanding: number;
  /** Principal in defaulted or written-off loans, net of recoveries. */
  defaultedPrincipalAtRisk: number;
  interestReceived: number;
  interestAccruedUnreceived: number;
  /** What a platform typically reports as "interest earned". */
  grossInterestBooked: number;
  recoveriesReceived: number;
  writtenOffPrincipal: number;
  amountOverdue: number;

  /** Cash actually returned to the investor, before tax. */
  realisedCashToInvestor: number;
  /** Booked interest as a multiple of realised interest. */
  bookingOverstatementRatio: number | null;
  /** Realised interest as a share of what the contractual schedule promised. */
  collectionEfficiency: number | null;

  defaultedLoanCount: number;
  delinquentLoanCount: number;
  /** Defaulted principal as a share of principal ever disbursed. */
  defaultRateByPrincipal: number | null;
  defaultRateByCount: number | null;
  /** Cash recovered as a share of defaulted principal. */
  recoveryRate: number | null;
  /** (1 − recovery) × defaulted principal. */
  netLossFromDefaults: number;
  /** Net loss as a share of total lent — the number that reduces the return. */
  lossRateOnPrincipal: number | null;

  concentration: P2PConcentration;
  weightedAverageRate: number | null;
  weightedAverageTenureMonths: number | null;

  warnings: string[];
}

/**
 * Portfolio-level aggregates.
 *
 * `lossRateOnPrincipal` and `collectorEfficiency` are deliberately computed
 * against principal ever disbursed, not against principal outstanding. A
 * default rate expressed against a shrunken remaining balance flatters the
 * figure as the portfolio matures — a well-known denominator trick.
 */
export function analyseP2PPortfolio(loans: P2PLoan[]): P2PPortfolioMetrics {
  const warnings: string[] = [];
  if (loans.length === 0) {
    return {
      loanCount: 0,
      totalLent: 0,
      feesPaid: 0,
      principalRepaid: 0,
      principalOutstanding: 0,
      defaultedPrincipalAtRisk: 0,
      interestReceived: 0,
      interestAccruedUnreceived: 0,
      grossInterestBooked: 0,
      recoveriesReceived: 0,
      writtenOffPrincipal: 0,
      amountOverdue: 0,
      realisedCashToInvestor: 0,
      bookingOverstatementRatio: null,
      collectionEfficiency: null,
      defaultedLoanCount: 0,
      delinquentLoanCount: 0,
      defaultRateByPrincipal: null,
      defaultRateByCount: null,
      recoveryRate: null,
      netLossFromDefaults: 0,
      lossRateOnPrincipal: null,
      concentration: { largestBorrowerShare: 0, hhi: 0, borrowerCount: 0, borrowersForHalf: 0, topShares: [] },
      weightedAverageRate: null,
      weightedAverageTenureMonths: null,
      warnings: ['No loans supplied; every metric is undefined rather than zero.'],
    };
  }

  const sum = (fn: (l: P2PLoan) => number): number => loans.reduce((s, l) => s + fn(l), 0);

  const totalLent = sum((l) => l.principal);
  const feesPaid = sum((l) => l.feesPaid);
  const principalRepaid = sum((l) => l.principalRepaid);
  const interestReceived = sum((l) => l.interestReceived);
  const interestAccruedUnreceived = sum((l) => l.interestAccruedUnreceived);
  const recoveriesReceived = sum((l) => l.recoveriesReceived ?? 0);
  const writtenOffPrincipal = sum((l) => l.writeOffPrincipal ?? 0);
  const amountOverdue = sum((l) => l.amountOverdue);

  const defaulted = loans.filter((l) => l.status === 'defaulted' || l.status === 'written-off');
  const delinquent = loans.filter((l) => l.status === 'delinquent');

  const defaultedPrincipal = defaulted.reduce((s, l) => s + l.principal, 0);
  const principalOutstanding = loans.reduce(
    (s, l) => s + Math.max(0, l.principal - l.principalRepaid - (l.writeOffPrincipal ?? 0)),
    0,
  );
  const defaultedPrincipalAtRisk = Math.max(0, defaultedPrincipal - recoveriesReceived - sum((l) => l.principalRepaid));

  const grossInterestBooked = interestReceived + interestAccruedUnreceived;
  const realisedCashToInvestor = principalRepaid + interestReceived + recoveriesReceived - feesPaid;

  const netLossFromDefaults = Math.max(0, defaultedPrincipal - recoveriesReceived);

  if (interestAccruedUnreceived > 0) {
    warnings.push(
      'Part of the reported interest has been accrued but not received in cash. If any of the underlying loans default, that accrued interest may never be paid — but it is frequently already taxable. Compare the booked figure with the realised figure before believing either.',
    );
  }
  if (defaulted.length > 0 && recoveriesReceived === 0) {
    warnings.push(
      'Loans have defaulted with no recoveries recorded. Unsecured retail recovery in India is slow and uncertain; assuming any particular recovery rate without evidence is speculation.',
    );
  }
  if (loans.length < 100) {
    warnings.push(
      `A portfolio of ${loans.length} loans is too small for the law of large numbers to work. Default experience in unsecured retail credit is highly dispersed at small loan counts, and a single large default can dominate the return.`,
    );
  }

  const weightedAverageRate =
    totalLent > 0 ? loans.reduce((s, l) => s + l.annualRate * l.principal, 0) / totalLent : null;
  const weightedAverageTenureMonths =
    totalLent > 0 ? loans.reduce((s, l) => s + l.tenureMonths * l.principal, 0) / totalLent : null;

  const borrowerExposure = new Map<string, number>();
  for (const l of loans) {
    borrowerExposure.set(l.borrowerId, (borrowerExposure.get(l.borrowerId) ?? 0) + l.principal);
  }
  const shares = [...borrowerExposure.values()]
    .map((v) => (totalLent > 0 ? v / totalLent : 0))
    .sort((a, b) => b - a);
  const hhi = shares.reduce((s, x) => s + x * x, 0);
  let cumulative = 0;
  let borrowersForHalf = 0;
  for (const s of shares) {
    cumulative += s;
    borrowersForHalf += 1;
    if (cumulative >= 0.5) break;
  }

  if (shares[0] !== undefined && shares[0] > 0.05) {
    warnings.push(
      `The largest single borrower represents ${(shares[0] * 100).toFixed(1)}% of the portfolio. Concentration of this size converts a diversified credit portfolio into a single-name credit bet.`,
    );
  }

  return {
    loanCount: loans.length,
    totalLent,
    feesPaid,
    principalRepaid,
    principalOutstanding,
    defaultedPrincipalAtRisk,
    interestReceived,
    interestAccruedUnreceived,
    grossInterestBooked,
    recoveriesReceived,
    writtenOffPrincipal,
    amountOverdue,
    realisedCashToInvestor,
    bookingOverstatementRatio: interestReceived > 0 ? grossInterestBooked / interestReceived : null,
    collectionEfficiency: grossInterestBooked > 0 ? interestReceived / grossInterestBooked : null,
    defaultedLoanCount: defaulted.length,
    delinquentLoanCount: delinquent.length,
    defaultRateByPrincipal: totalLent > 0 ? defaultedPrincipal / totalLent : null,
    defaultRateByCount: loans.length > 0 ? defaulted.length / loans.length : null,
    recoveryRate: defaultedPrincipal > 0 ? recoveriesReceived / defaultedPrincipal : null,
    netLossFromDefaults,
    lossRateOnPrincipal: totalLent > 0 ? netLossFromDefaults / totalLent : null,
    concentration: {
      largestBorrowerShare: shares[0] ?? 0,
      hhi,
      borrowerCount: borrowerExposure.size,
      borrowersForHalf,
      topShares: shares.slice(0, 10),
    },
    weightedAverageRate,
    weightedAverageTenureMonths,
    warnings,
  };
}

/**
 * Build the dated cash-flow series required for a true money-weighted return.
 * The disbursement is negative, and every subsequent receipt is positive. If
 * the portfolio is still live, a terminal notional value can be included so
 * that the XIRR reflects mark-to-model rather than realisable cash.
 */
export function p2pCashFlows(
  loans: P2PLoan[],
  options: { includeUnrealisedOutstanding?: boolean; valuationDate?: Date } = {},
): CashFlow[] {
  const flows: CashFlow[] = [];
  for (const l of loans) {
    flows.push({ date: l.disbursementDate, amount: -l.principal, label: `${l.id} disbursement` });
    // Cash receipts are not dated in the raw data; modelling them as a single
    // receipt at the valuation date is a conservative simplification that
    // understates the return slightly versus true receipt dates.
    const receiptDate = options.valuationDate ?? new Date();
    if (l.interestReceived > 0) {
      flows.push({ date: receiptDate, amount: l.interestReceived, label: `${l.id} interest received` });
    }
    if (l.principalRepaid > 0) {
      flows.push({ date: receiptDate, amount: l.principalRepaid, label: `${l.id} principal repaid` });
    }
    if ((l.recoveriesReceived ?? 0) > 0) {
      flows.push({ date: receiptDate, amount: l.recoveriesReceived ?? 0, label: `${l.id} recovery` });
    }
    if (l.feesPaid > 0) {
      flows.push({ date: receiptDate, amount: -l.feesPaid, label: `${l.id} fees` });
    }
    if (options.includeUnrealisedOutstanding) {
      const outstanding = Math.max(0, l.principal - l.principalRepaid - (l.writeOffPrincipal ?? 0));
      if (outstanding > 0) {
        flows.push({ date: receiptDate, amount: outstanding, label: `${l.id} outstanding (unrealised)` });
      }
    }
  }
  return flows;
}

export interface P2PScenario {
  label: string;
  /** Additional share of currently-performing principal that defaults. */
  additionalDefaultRate: number;
  /** Recovery rate applied to newly defaulted principal. */
  recoveryRate: number;
  /** Haircut applied to accrued-but-unreceived interest. */
  accruedHaircut: number;
}

export interface P2PScenarioResult extends P2PScenario {
  totalLoss: number;
  netRealised: number;
  /** Realised return on total lent after scenario losses, ignoring time value. */
  returnOnPrincipal: number | null;
  /** Approximate annualised return over the portfolio's weighted-average life. */
  approximateAnnualised: number | null;
}

/**
 * Scenario and stress analysis.
 *
 * The scenarios are explicit and the arithmetic is transparent: this is a
 * stress test, not a forecast. The most important scenario to compute is
 * usually the one where the platform's own reported default rate is wrong.
 */
export function stressTest(
  loans: P2PLoan[],
  scenarios: P2PScenario[],
): P2PScenarioResult[] {
  const metrics = analyseP2PPortfolio(loans);
  const performingPrincipal = Math.max(0, metrics.principalOutstanding - metrics.amountOverdue);

  return scenarios.map((scenario) => {
    const newlyDefaulted = performingPrincipal * scenario.additionalDefaultRate;
    const newRecovery = newlyDefaulted * scenario.recoveryRate;
    const newLoss = newlyDefaulted - newRecovery;
    const accruedLoss = metrics.interestAccruedUnreceived * scenario.accruedHaircut;
    const totalLoss = metrics.netLossFromDefaults + newLoss + accruedLoss;
    const netRealised =
      metrics.realisedCashToInvestor + newRecovery - accruedLoss - metrics.netLossFromDefaults;

    const horizonYears = (metrics.weightedAverageTenureMonths ?? 12) / 12;
    const capitalAtRisk = metrics.totalLent;
    const returnOnPrincipal = capitalAtRisk > 0 ? (netRealised - capitalAtRisk) / capitalAtRisk : null;
    const approximateAnnualised =
      returnOnPrincipal !== null && horizonYears > 0
        ? Math.pow(1 + returnOnPrincipal, 1 / horizonYears) - 1
        : null;

    return {
      ...scenario,
      totalLoss,
      netRealised,
      returnOnPrincipal,
      approximateAnnualised,
    };
  });
}

/** Default scenarios an investor should always run before committing capital. */
export function defaultScenarios(platformReportedDefaultRate: number): P2PScenario[] {
  const base = Math.max(0, platformReportedDefaultRate);
  return [
    { label: 'Platform case as reported', additionalDefaultRate: 0, recoveryRate: 0.15, accruedHaircut: 0.25 },
    { label: 'Double the reported default rate', additionalDefaultRate: base, recoveryRate: 0.15, accruedHaircut: 0.4 },
    { label: 'Triple, with weak recoveries', additionalDefaultRate: base * 2, recoveryRate: 0.05, accruedHaircut: 0.6 },
    {
      label: 'Credit cycle: 4× defaults, no recoveries, accrued interest written off',
      additionalDefaultRate: base * 3,
      recoveryRate: 0,
      accruedHaircut: 1,
    },
  ];
}

export interface VintageBucket {
  vintage: string;
  loanCount: number;
  principal: number;
  defaultRateByPrincipal: number | null;
  recoveryRate: number | null;
  netLossRate: number | null;
  /** Months of observed performance; short vintages cannot be compared with long ones. */
  observedMonths: number;
}

/**
 * Vintage analysis: group loans by disbursement year.
 *
 * Comparing an 8-month-old vintage with a 4-year-old vintage always shows the
 * young vintage as pristine, because most retail defaults occur in the second
 * and third year. The observed horizon is returned with every bucket so that
 * comparison cannot be made silently.
 */
export function vintageAnalysis(loans: P2PLoan[], referenceDate = new Date()): VintageBucket[] {
  const buckets = new Map<string, P2PLoan[]>();
  for (const l of loans) {
    const key = String(l.disbursementDate.getUTCFullYear());
    const list = buckets.get(key);
    if (list) list.push(l);
    else buckets.set(key, [l]);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([vintage, group]) => {
      const principal = group.reduce((s, l) => s + l.principal, 0);
      const def = group.filter((l) => l.status === 'defaulted' || l.status === 'written-off');
      const defaultedPrincipal = def.reduce((s, l) => s + l.principal, 0);
      const recoveries = def.reduce((s, l) => s + (l.recoveriesReceived ?? 0), 0);
      const oldest = group.reduce(
        (min, l) => Math.min(min, l.disbursementDate.getTime()),
        Number.POSITIVE_INFINITY,
      );
      const observedMonths = Number.isFinite(oldest)
        ? Math.max(0, (referenceDate.getTime() - oldest) / 86_400_000 / 30.44)
        : 0;
      return {
        vintage,
        loanCount: group.length,
        principal,
        defaultRateByPrincipal: principal > 0 ? defaultedPrincipal / principal : null,
        recoveryRate: defaultedPrincipal > 0 ? recoveries / defaultedPrincipal : null,
        netLossRate: principal > 0 ? (defaultedPrincipal - recoveries) / principal : null,
        observedMonths,
      };
    });
}

/**
 * Diversification curve: how the probability of a material loss falls as the
 * number of independent loans rises.
 *
 * Uses a binomial model with an explicit assumed default probability and loss
 * given default. The point is not the precise probability — the assumption is
 * the input — but the *shape*: the marginal benefit of the hundredth loan is
 * tiny, while the marginal benefit of moving from 10 loans to 100 is large.
 */
export function diversificationCurve(
  defaultProbability: number,
  lossGivenDefault: number,
  loanSizes: number[] = [5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 500],
  lossThreshold = 0.05,
): { loanCount: number; probabilityOfMaterialLoss: number; expectedLossRate: number }[] {
  const binomialPmf = (n: number, k: number, p: number): number => {
    if (k < 0 || k > n) return 0;
    let logCoeff = 0;
    for (let i = 1; i <= k; i += 1) {
      logCoeff += Math.log(n - k + i) - Math.log(i);
    }
    return Math.exp(logCoeff + k * Math.log(Math.max(p, 1e-12)) + (n - k) * Math.log(Math.max(1 - p, 1e-12)));
  };

  return loanSizes.map((n) => {
    // Loss rate = (defaults/n) × LGD. Material loss means the loss rate exceeds the threshold.
    const minDefaults = Math.ceil((lossThreshold / lossGivenDefault) * n);
    let tail = 0;
    for (let k = minDefaults; k <= n; k += 1) {
      tail += binomialPmf(n, k, defaultProbability);
    }
    return {
      loanCount: n,
      probabilityOfMaterialLoss: Math.min(1, tail),
      expectedLossRate: defaultProbability * lossGivenDefault,
    };
  });
}

/** Money-weighted return of a P2P portfolio from its reconstructed cash flows. */
export function p2pXirr(
  loans: P2PLoan[],
  options: { includeUnrealisedOutstanding?: boolean; valuationDate?: Date } = {},
) {
  return xirr(p2pCashFlows(loans, options));
}

/**
 * Platform-failure exposure: the share of the portfolio whose servicing depends
 * on a single platform continuing to operate. This is a *platform* risk, and it
 * is entirely separate from the *borrower* credit risk of the same loans.
 */
export function platformConcentration(loansByPlatform: Record<string, P2PLoan[]>): {
  platform: string;
  principal: number;
  share: number;
  warning?: string;
}[] {
  const totals = Object.entries(loansByPlatform).map(([platform, loans]) => ({
    platform,
    principal: loans.reduce((s, l) => s + l.principal, 0),
  }));
  const grand = totals.reduce((s, t) => s + t.principal, 0);
  return totals
    .map((t) => {
      const share = grand > 0 ? t.principal / grand : 0;
      const warning =
        share > 0.5
          ? 'More than half of this portfolio is serviced by one platform. If it stops operating, collections, disbursements and recovery will depend on whichever administrator takes over — a risk that is not priced into the interest rate.'
          : undefined;
      return {
        ...t,
        share,
        ...(warning === undefined ? {} : { warning }),
      };
    })
    .sort((a, b) => b.principal - a.principal);
}
