/**
 * Calculator computations — fixed income, credit and peer-to-peer lending.
 */
import {
  bondDurations,
  creditValuation,
  exactPriceChange,
  expectedCreditLoss,
  perpetualBondPrice,
  priceBond,
  priceChangeEstimate,
  requiredYieldForLoss,
  spreadInBps,
  yieldFromPrice,
  type BondSpec,
} from '../finance/bonds';
import { realReturn } from '../finance/returns';
import { n, out, pct, res, s, round } from './types';
import type { CalcResult, InputRecord } from './types';

const PCT = (x: number | null): number | null => (x === null || !Number.isFinite(x) ? null : round(x * 100, 2));

function specFrom(v: InputRecord, options: { yearsKey?: string; frequencyKey?: string } = {}): BondSpec {
  const yearsKey = options.yearsKey ?? 'yearsToMaturity';
  const frequencyKey = options.frequencyKey ?? 'frequency';
  return {
    couponRate: pct(v, 'couponRate'),
    frequency: Number.parseInt(s(v, frequencyKey, '2'), 10) || 2,
    yearsToMaturity: n(v, yearsKey, 0),
  };
}

export const fixedIncomeCalculators: Record<string, (v: InputRecord) => CalcResult> = {
  'deposit-comparison'(v) {
    const amount = n(v, 'amount', 0);
    const rateA = pct(v, 'rateA');
    const rateB = pct(v, 'rateB');
    const tax = pct(v, 'marginalRate');
    const inflation = pct(v, 'inflation');
    const years = n(v, 'years', 0);
    const rows = [
      { label: 'Option A', rate: rateA },
      { label: 'Option B', rate: rateB },
    ].map((o) => {
      const net = o.rate * (1 - tax);
      const real = realReturn(net, inflation);
      return {
        label: o.label,
        gross: o.rate,
        net,
        real,
        value: amount * (1 + net) ** years,
      };
    });
    const a = rows[0];
    const z = rows[1];
    return res(
      [
        out('Option A: annual nominal return', PCT(a?.gross ?? null), 'percent'),
        out('Option A: post-tax nominal return', PCT(a?.net ?? null), 'percent'),
        out('Option A: post-tax real return', PCT(a?.real ?? null), 'percent', {
          tone: (a?.real ?? 0) < 0 ? 'negative' : 'positive',
        }),
        out('Option B: post-tax real return', PCT(z?.real ?? null), 'percent', {
          tone: (z?.real ?? 0) < 0 ? 'negative' : 'positive',
        }),
        out('Difference in post-tax nominal return', a && z ? round((z.net - a.net) * 100, 2) : null, 'percent', {
          note: 'This is the compensation on offer for the extra credit risk of Option B.',
        }),
        out('Value after the period at Option A', a ? round(a.value, 0) : null, 'currency'),
        out('Value after the period at Option B', z ? round(z.value, 0) : null, 'currency'),
      ],
      ['A higher rate on a corporate deposit is payment for credit risk. A single default can erase more than the entire spread.'],
      ['Interest on deposits is taxed every year on accrual, even when the deposit pays only at maturity.'],
    );
  },

  'bond-price-yield'(v) {
    const spec = specFrom(v);
    const faceValue = n(v, 'faceValue', 1000);
    const required = pct(v, 'yieldRequired');
    const priced = priceBond(spec, required);
    const durations = bondDurations(spec, required);
    const observed = n(v, 'observedPrice', 100);
    const solved = observed !== 100 ? yieldFromPrice(spec, observed) : null;
    const warnings: string[] = [];
    const outputs = [
      out('Price per ₹100 of face value at the required yield', round(priced.cleanPrice, 3), 'number'),
      out('Accrued interest per ₹100', round(priced.accruedInterest, 4), 'number'),
      out('Price for the face value entered', round((priced.cleanPrice / 100) * faceValue, 2), 'currency'),
      out('Annual coupon per ₹100', round(priced.annualCouponPer100, 3), 'number'),
    ];
    if (solved) {
      if (solved.yield !== null) {
        outputs.push(
          out('Yield implied by the observed price', PCT(solved.yield), 'percent', { note: solved.framework }),
        );
        outputs.push(
          out('Price change from the required yield to the implied yield', PCT(exactPriceChange(spec, required, solved.yield)), 'percent'),
        );
      } else {
        warnings.push(solved.error ?? 'The observed price could not be reconciled with a yield.');
      }
    }
    return res(
      outputs,
      [
        ...warnings,
        ...(durations.warning ? [durations.warning] : []),
        'Assumes redemption at par on a coupon date and no embedded options. Indian quote conventions differ between G-secs, corporate bonds and money-market instruments; confirm which one a price uses before comparing.',
      ],
      [],
    );
  },

  'bond-ladder'(v) {
    const total = n(v, 'total', 0);
    const rungs = Math.max(1, Math.round(n(v, 'rungs', 5)));
    const yieldRate = pct(v, 'yieldRate');
    const withdrawal = n(v, 'annualWithdrawal', 0);
    const perRung = total / rungs;
    let balance = 0;
    const rows: { label: string; value: string }[] = [];
    for (let y = 1; y <= rungs; y += 1) {
      balance += perRung;
      const interest = balance * yieldRate;
      balance += interest;
      const paid = Math.min(withdrawal, balance);
      balance -= paid;
      rows.push({
        label: `Year ${y}`,
        value: `Rung matures: ₹${Math.round(perRung).toLocaleString('en-IN')} · interest ₹${Math.round(interest).toLocaleString('en-IN')} · withdrawn ₹${Math.round(paid).toLocaleString('en-IN')} · balance ₹${Math.round(balance).toLocaleString('en-IN')}`,
      });
    }
    return res(
      [
        out('Amount per rung', round(perRung, 0), 'currency'),
        out('Rungs', rungs, 'number'),
        out('Balance after the ladder completes', round(balance, 0), 'currency'),
        out('Total withdrawn', round(Math.min(withdrawal * rungs, total + total * yieldRate * rungs * 0.5), 0), 'currency', {
          note: 'Approximate; the exact total depends on when each rung matures.',
        }),
      ],
      ['A ladder spreads interest-rate risk across time rather than removing it. If rates fall permanently, later rungs are reinvested at lower yields.'],
      ['Assumes an instrument of the required maturity is available for each rung at the assumed yield. Indian corporate bonds are not always available at every maturity.'],
      rows,
    );
  },

  'modified-duration'(v) {
    const spec = specFrom(v);
    const yieldRate = pct(v, 'yieldRequired');
    const faceValue = n(v, 'faceValue', 1000000);
    const d = bondDurations(spec, yieldRate);
    const warnings: string[] = [];
    if (d.warning) warnings.push(d.warning);
    return res(
      [
        out('Macaulay duration', d.macaulayDuration === null ? null : round(d.macaulayDuration, 3), 'years'),
        out('Modified duration', d.modifiedDuration === null ? null : round(d.modifiedDuration, 3), 'years'),
        out('Effective duration (repriced)', d.effectiveDuration === null ? null : round(d.effectiveDuration, 3), 'years'),
        out('Convexity', d.convexity === null ? null : round(d.convexity, 2), 'number'),
        out('Price value of one basis point', d.dv01 === null ? null : round((d.dv01 / 100) * faceValue, 2), 'currency'),
      ],
      warnings,
      [
        'Duration is a linear approximation valid for small yield moves. Beyond roughly 50 basis points, convexity matters.',
        'For bonds with embedded options or floating rates, only effective duration is meaningful.',
      ],
    );
  },

  convexity(v) {
    const spec = specFrom(v);
    const yieldRate = pct(v, 'yieldRequired');
    const shockBps = n(v, 'shockBps', 0);
    const d = bondDurations(spec, yieldRate);
    const shock = shockBps / 10_000;
    const estimate = d.modifiedDuration === null || d.convexity === null
      ? null
      : priceChangeEstimate(d.modifiedDuration, d.convexity, shock);
    const exact = exactPriceChange(spec, yieldRate, yieldRate + shock);
    return res(
      [
        out('Convexity', d.convexity === null ? null : round(d.convexity, 2), 'number'),
        out('Price change by duration alone', estimate === null ? null : PCT(estimate.linearOnly), 'percent'),
        out('Price change including convexity', estimate === null ? null : PCT(estimate.withConvexity), 'percent'),
        out('Convexity contribution', estimate === null ? null : PCT(estimate.convexityContribution), 'percent'),
        out('Exact price change from repricing', PCT(exact), 'percent'),
      ],
      shockBps === 0 ? ['Enter a non-zero yield shock to see an effect.'] : [],
      [
        'Higher convexity is paid for with a lower yield. The benefit is priced, not free.',
        'A single convexity number is inadequate for large shocks or for a portfolio spread across maturities; key-rate durations are needed there.',
      ],
    );
  },

  'credit-spread'(v) {
    const risky = pct(v, 'riskyYield');
    const benchmark = pct(v, 'benchmarkYield');
    const years = n(v, 'yearsToMaturity', 0);
    const recovery = pct(v, 'recoveryRate');
    const investment = n(v, 'investment', 0);
    const spread = risky - benchmark;
    const breakEvenPd = 1 - recovery > 0 ? spread / (1 - recovery) : Number.NaN;
    const valuation = creditValuation({
      probabilityOfDefault: Number.isFinite(breakEvenPd) ? breakEvenPd : 0.03,
      recoveryRate: recovery,
      riskFreeRate: benchmark,
      couponRate: risky,
      frequency: 2,
      yearsToMaturity: Math.max(0.25, years),
    });
    return res(
      [
        out('Spread over the benchmark', round(spread * 10_000, 0), 'number', { note: 'In basis points.' }),
        out('Annual default probability the spread compensates', PCT(breakEvenPd), 'percent', {
          note: 'Break-even, ignoring risk premia and liquidity compensation.',
        }),
        out('Cumulative default probability over the term (market-implied)', PCT(valuation.cumulativeDefaultProbability), 'percent'),
        out('Expected loss per year of exposure', round(investment * breakEvenPd * (1 - recovery), 0), 'currency'),
        out('Yield required to cover the expected loss', PCT(requiredYieldForLoss(benchmark, Number.isFinite(breakEvenPd) ? breakEvenPd : 0.03, recovery) - benchmark), 'percent'),
      ],
      [
        'The recovery assumption drives the result, and Indian retail investors rarely have independent evidence of recovery rates. Do not assume 40% is conservative for unsecured or subordinated debt.',
        'Some of any spread compensates illiquidity and risk aversion rather than expected default, so the implied default probability is not a forecast.',
      ],
      [],
    );
  },

  'default-recovery'(v) {
    const exposure = n(v, 'exposure', 0);
    const pd = pct(v, 'probabilityOfDefault');
    const recovery = pct(v, 'recoveryRate');
    const years = n(v, 'years', 0);
    const riskFree = pct(v, 'riskFreeRate');
    const ecl = expectedCreditLoss(exposure, pd, recovery);
    const cumulative = 1 - (1 - pd) ** years;
    return res(
      [
        out('Loss given default', PCT(ecl.lossGivenDefault), 'percent'),
        out('Expected credit loss in the first year', round(ecl.expectedLoss, 0), 'currency'),
        out('Cumulative probability of default over the horizon', PCT(cumulative), 'percent'),
        out('Expected loss over the horizon', round(exposure * cumulative * ecl.lossGivenDefault, 0), 'currency'),
        out('Yield required to break even after expected loss', PCT(requiredYieldForLoss(riskFree, pd, recovery)), 'percent'),
        out('Excess over the benchmark', PCT(requiredYieldForLoss(riskFree, pd, recovery) - riskFree), 'percent'),
      ],
      [
        'Expected loss is a mean. Realised outcomes are lumpy: each exposure either repays or does not, so a portfolio of expected losses behaves nothing like a portfolio of average outcomes.',
        'PD and recovery figures supplied by a lender are the lender’s own assumptions and are rarely independently audited.',
      ],
      [],
    );
  },

  'callable-bond-price'(v) {
    const face = n(v, 'faceValue', 0);
    const coupon = pct(v, 'couponRate');
    const yearsToCall = n(v, 'yearsToCall', 0);
    const required = pct(v, 'yieldRequired');
    const callPrice = pct(v, 'callPrice') * 100;
    const perpetual = v.isPerpetual === true || s(v, 'isPerpetual') === 'true';
    if (perpetual) {
      const result = perpetualBondPrice(coupon * 100, required);
      return res(
        [
          out('Price per ₹100 of face value', round(result.price, 3), 'number'),
          out('Price for the face value entered', round((result.price / 100) * face, 0), 'currency'),
          out('Current yield', PCT(coupon), 'percent'),
        ],
        result.limitations,
        [],
      );
    }
    const spec: BondSpec = { couponRate: coupon, frequency: 2, yearsToMaturity: yearsToCall, redemptionValue: callPrice };
    const priced = priceBond(spec, required);
    const ytc = yieldFromPrice(spec, 100).yield;
    const called = priced.cleanPrice > callPrice;
    return res(
      [
        out('Price to the call date per ₹100', round(priced.cleanPrice, 3), 'number'),
        out('Price for the face value entered', round((priced.cleanPrice / 100) * face, 0), 'currency'),
        out('Yield to call at par', PCT(ytc), 'percent'),
        out('Call is likely to be exercised', called ? 'Yes — the bond prices above the call price' : 'No — the bond prices below the call price', 'text'),
      ],
      [
        'Assumes the issuer acts rationally at the call date and that coupons are never deferred. Indian AT1 instruments permit coupon skips and principal write-down, so a formula price can materially overstate what will be received.',
        'Callable bonds are negatively convex near the call date: the gain is capped when rates fall, but the loss is not capped when they rise.',
      ],
      [],
    );
  },

  'interest-rate-risk'(v) {
    const value = n(v, 'portfolioValue', 0);
    const duration = n(v, 'modifiedDuration', 0);
    const convexity = n(v, 'convexity', 0);
    const shockBps = n(v, 'shockBps', 0);
    const shock = shockBps / 10_000;
    const estimate = priceChangeEstimate(duration, convexity, shock);
    return res(
      [
        out('Change in portfolio value (duration only)', round(value * estimate.linearOnly, 0), 'currency', {
          tone: estimate.linearOnly < 0 ? 'negative' : 'positive',
        }),
        out('Change including convexity', round(value * estimate.withConvexity, 0), 'currency', {
          tone: estimate.withConvexity < 0 ? 'negative' : 'positive',
        }),
        out('Proportional price change', PCT(estimate.withConvexity), 'percent'),
        out('Convexity contribution', round(value * estimate.convexityContribution, 0), 'currency'),
        out('Value after the shock', round(value * (1 + estimate.withConvexity), 0), 'currency'),
      ],
      ['Modified duration assumes a parallel shift in the yield curve. Real curve moves are rarely parallel, and credit spread changes are not yield-curve changes at all.'],
      [],
    );
  },

  'yield-on-cost'(v) {
    const cost = n(v, 'originalCost', 0);
    const value = n(v, 'currentValue', 0);
    const income = n(v, 'currentIncome', 0);
    const onCost = cost > 0 ? income / cost : null;
    const onValue = value > 0 ? income / value : null;
    return res(
      [
        out('Yield on cost', PCT(onCost), 'percent', { note: 'Income against what you paid.' }),
        out('Current yield', PCT(onValue), 'percent', { note: 'Income against what a buyer would pay today.' }),
        out('Capital appreciation so far', cost > 0 ? PCT(value / cost - 1) : null, 'percent'),
        out('Income received as a share of the appreciation', value - cost > 0 ? round(income / Math.max(1, value - cost), 3) : null, 'multiple'),
      ],
      ['Yield on cost is a backward-looking comfort metric and is frequently used to justify holding an asset that no longer offers an attractive forward return.'],
      [],
    );
  },

  'p2p-return'(v) {
    const lent = n(v, 'totalLent', 0);
    const interestReceived = n(v, 'interestReceived', 0);
    const accrued = n(v, 'interestAccrued', 0);
    const fees = n(v, 'feesPaid', 0);
    const defaulted = n(v, 'defaultedPrincipal', 0);
    const recoveries = n(v, 'recoveries', 0);
    const months = n(v, 'months', 0);
    const tax = pct(v, 'marginalRate');
    const years = months / 12;
    const reportedCash = interestReceived + accrued;
    const realisedCash = interestReceived + recoveries - fees - defaulted;
    const reported = years > 0 && lent > 0 ? Math.pow(Math.max(0, lent + reportedCash) / lent, 1 / years) - 1 : null;
    const realised = years > 0 && lent > 0 ? Math.pow(Math.max(0, lent + realisedCash) / lent, 1 / years) - 1 : null;
    const afterTax = realised === null ? null : realised * (1 - tax);
    return res(
      [
        out('Return implied by booked interest', PCT(reported), 'percent', {
          note: 'What the platform statement implies, treating accrued interest as earned.',
        }),
        out('Realised return in cash', PCT(realised), 'percent', {
          note: 'Interest actually received, plus recoveries, less fees and defaulted principal.',
          tone: realised !== null && realised < 0 ? 'negative' : 'neutral',
        }),
        out('Difference between reported and realised', reported !== null && realised !== null ? round((reported - realised) * 100, 2) : null, 'percent', { tone: 'caution' }),
        out('Post-tax realised return at slab rates', PCT(afterTax), 'percent'),
        out('Cash still at risk (defaulted principal unrecovered)', round(Math.max(0, defaulted - recoveries), 0), 'currency'),
      ],
      [
        'Interest on P2P lending is taxed at slab rates in the year it is credited, whether or not it has been received. Tax on interest that later defaults is a common outcome.',
        'Recovery on Indian unsecured retail defaults is slow, uncertain and platform-dependent. Treat any recovery figure as an estimate.',
        'This calculation ignores interest on performing loans that has not yet been credited, which understates the return if those loans continue to pay.',
      ],
      ['The realised figure uses cash actually received, which is the only defensible basis for a claim about P2P returns.'],
    );
  },

  'p2p-stress'(v) {
    const performing = n(v, 'performingPrincipal', 0);
    const totalLent = n(v, 'totalLent', 0);
    const interestReceived = n(v, 'interestReceived', 0);
    const accrued = n(v, 'interestAccrued', 0);
    const reported = pct(v, 'reportedDefaultRate');
    const horizon = n(v, 'horizonYears', 0);
    const scenarios = [
      { label: 'Platform’s reported rate', pd: reported, recovery: 0.15 },
      { label: 'Twice the reported rate', pd: reported * 2, recovery: 0.1 },
      { label: 'Three times the reported rate', pd: reported * 3, recovery: 0.05 },
    ];
    const rows = scenarios.map((sc) => {
      const losses = performing * (1 - (1 - sc.pd) ** horizon) * (1 - sc.recovery);
      const net = interestReceived + accrued - losses;
      const returnOnLent = totalLent > 0 ? net / totalLent : null;
      return { ...sc, losses, net, returnOnLent };
    });
    return res(
      rows.flatMap((r) => [
        out(`Losses: ${r.label}`, round(r.losses, 0), 'currency', { tone: 'caution' }),
        out(`Net outcome: ${r.label}`, round(r.net, 0), 'currency', { tone: r.net < 0 ? 'negative' : 'neutral' }),
        out(`Return on principal: ${r.label}`, PCT(r.returnOnLent), 'percent'),
      ]),
      [
        'The scenarios are arithmetic, not forecasts. Their purpose is to show how much the outcome depends on an assumption the investor cannot independently verify.',
        'Defaults cluster. In a credit cycle, the independence assumption behind these calculations breaks down and the losses arrive together.',
      ],
      [],
    );
  },

  'p2p-diversification'(v) {
    const pd = pct(v, 'defaultProbability');
    const lgd = pct(v, 'lossGivenDefault');
    const threshold = pct(v, 'lossThreshold');
    const maxLoans = Math.max(10, Math.round(n(v, 'maxLoans', 300)));
    const assessment = [10, 25, 50, 100, 200, maxLoans]
      .filter((count, index, arr) => arr.indexOf(count) === index && count <= maxLoans)
      .map((count) => {
        // Probability that losses exceed the threshold share of capital.
        const lossesNeeded = Math.ceil((threshold / Math.max(1e-9, lgd)) * count);
        let tail = 0;
        for (let k = lossesNeeded; k <= count; k += 1) {
          tail += binomialProbability(count, k, pd);
        }
        return { count, tail: Math.min(1, tail) };
      });
    return res(
      assessment.flatMap((a) => [
        out(`Number of loans: ${a.count}`, round(a.tail * 100, 3), 'percent', {
          note: `Probability of losing more than ${round(threshold * 100, 1)}% of capital.`,
        }),
      ]),
      [
        'The binomial model assumes defaults are independent. In a credit cycle they are not: defaults cluster by borrower quality, employer and region, so the true tail is fatter than any figure here.',
        'Diversification reduces the risk of a bad outcome but does not improve the expected return. If the expected loss exceeds the spread, more loans simply make the loss more certain.',
      ],
      [`Expected loss per loan is ${round(pd * lgd * 100, 2)}% of principal, which no amount of diversification can change.`],
    );
  },

  'deposit-reinvestment-risk'(v) {
    const total = n(v, 'totalDeposits', 0);
    const current = pct(v, 'currentRate');
    const change = pct(v, 'rateChange');
    const share = pct(v, 'shareRenewing');
    const tax = pct(v, 'marginalRate');
    const incomeNow = total * current;
    const renewingAmount = total * share;
    const incomeAfter = incomeNow + renewingAmount * change;
    return res(
      [
        out('Current annual interest income', round(incomeNow, 0), 'currency'),
        out('Income after the rate change', round(incomeAfter, 0), 'currency'),
        out('Change in annual income', round(incomeAfter - incomeNow, 0), 'currency', {
          tone: incomeAfter < incomeNow ? 'negative' : 'positive',
        }),
        out('Change after tax', round((incomeAfter - incomeNow) * (1 - tax), 0), 'currency'),
        out('Amount repriced this year', round(renewingAmount, 0), 'currency'),
      ],
      [],
      [
        'Deposits carry reinvestment risk rather than price risk. A ladder spreads the repricing across years instead of concentrating it in one.',
        'Interest is taxed as it accrues, whether or not it has been received in cash.',
      ],
    );
  },
};

function binomialProbability(nTrials: number, successes: number, probability: number): number {
  if (successes < 0 || successes > nTrials) return 0;
  const p = Math.max(0, Math.min(1, probability));
  if (p === 0) return successes === 0 ? 1 : 0;
  if (p === 1) return successes === nTrials ? 1 : 0;
  let logCoefficient = 0;
  for (let i = 1; i <= successes; i += 1) {
    logCoefficient += Math.log(nTrials - successes + i) - Math.log(i);
  }
  const logProbability =
    logCoefficient + successes * Math.log(p) + (nTrials - successes) * Math.log(1 - p);
  return Math.exp(logProbability);
}

// Referenced by the credit-spread calculator; kept exported for testing.
export { spreadInBps };
