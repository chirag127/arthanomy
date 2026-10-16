/**
 * Calculator computations — portfolio construction, risk and planning.
 */
import {
  buildCovariance,
  concentrationHHI,
  diversificationRatio,
  effectivePositions,
  liquidityCoverage,
  minimumVarianceWeights,
  portfolioExpectedReturn,
  portfolioVolatility,
  rebalance,
  riskParityWeights,
} from '../finance/portfolio';
import { analyseDrawdowns, monteCarlo, mulberry32, normalSampler, quantile } from '../finance/statistics';
import { cagr, realReturn } from '../finance/returns';
import { n, out, pct, res, round } from './types';
import type { CalcResult, InputRecord } from './types';

const PCT = (x: number | null): number | null => (x === null || !Number.isFinite(x) ? null : round(x * 100, 2));

/** Correlation assumptions for the multi-asset calculator, stated explicitly. */
const MULTI_ASSET_CORRELATIONS: Record<string, Record<string, number>> = {
  equity: { equity: 1, debt: 0.05, gold: 0.1, global: 0.65, cash: 0.0 },
  debt: { equity: 0.05, debt: 1, gold: 0.15, global: 0.02, cash: 0.35 },
  gold: { equity: 0.1, debt: 0.15, gold: 1, global: 0.12, cash: 0.02 },
  global: { equity: 0.65, debt: 0.02, gold: 0.12, global: 1, cash: 0.0 },
  cash: { equity: 0.0, debt: 0.35, gold: 0.02, global: 0.0, cash: 1 },
};

export const portfolioCalculators: Record<string, (v: InputRecord) => CalcResult> = {
  'portfolio-allocation'(v) {
    const weights = [pct(v, 'w1'), pct(v, 'w2'), pct(v, 'w3')].map((x) => Math.max(0, x));
    const expected = [pct(v, 'r1'), pct(v, 'r2'), pct(v, 'r3')];
    const vols = [pct(v, 'v1'), pct(v, 'v2'), pct(v, 'v3')];
    const c12 = n(v, 'c12', 0);
    const c13 = n(v, 'c13', 0);
    const c23 = n(v, 'c23', 0);
    const correlations = [
      [1, c12, c13],
      [c12, 1, c23],
      [c13, c23, 1],
    ];
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    const normalised = totalWeight > 0 ? weights.map((w) => w / totalWeight) : weights;
    const covariance = buildCovariance(vols, correlations);
    const er = portfolioExpectedReturn(normalised, expected);
    const vol = portfolioVolatility(normalised, covariance);
    const dr = vol !== null ? diversificationRatio(normalised, vols, vol) : null;
    const weightedVol = normalised.reduce((s, w, i) => s + w * (vols[i] ?? 0), 0);
    const warnings: string[] = [];
    if (Math.abs(totalWeight - 1) > 0.005) {
      warnings.push(
        `The weights entered add to ${round(totalWeight * 100, 1)}%, so they have been scaled to 100%. Enter weights that add up if you want the figures to correspond to your actual allocation.`,
      );
    }
    return res(
      [
        out('Expected portfolio return', PCT(er), 'percent'),
        out('Portfolio volatility', PCT(vol), 'percent'),
        out('Weighted average volatility of the components', PCT(weightedVol), 'percent', {
          note: 'What the volatility would be with no diversification benefit.',
        }),
        out('Diversification ratio', dr === null ? null : round(dr, 3), 'multiple', {
          note: 'Higher means more of the individual risk has been cancelled.',
        }),
        out('Volatility reduction from diversification', PCT(weightedVol - (vol ?? 0)), 'percent'),
        out('Average pairwise correlation', round((c12 + c13 + c23) / 3, 3), 'number'),
      ],
      warnings,
      [
        'Correlation estimates are unstable and move toward 1 in every crisis, exactly when diversification is needed most.',
        'Expected returns are assumptions supplied by you. The calculator propagates them and cannot judge whether they are sensible.',
      ],
    );
  },

  'multi-asset'(v) {
    const keys = ['equity', 'debt', 'gold', 'global', 'cash'] as const;
    const weights = [pct(v, 'wEquity'), pct(v, 'wDebt'), pct(v, 'wGold'), pct(v, 'wGlobal'), pct(v, 'wCash')];
    const expected = [pct(v, 'rEquity'), pct(v, 'rDebt'), pct(v, 'rGold'), pct(v, 'rGlobal'), pct(v, 'rCash')];
    const vols = [0.16, 0.05, 0.14, 0.15, 0.01];
    const correlations = keys.map((a) => keys.map((b) => MULTI_ASSET_CORRELATIONS[a]?.[b] ?? 0));
    const total = weights.reduce((s, w) => s + w, 0);
    const normalised = total > 0 ? weights.map((w) => w / total) : weights;
    const covariance = buildCovariance(vols, correlations);
    const er = portfolioExpectedReturn(normalised, expected);
    const vol = portfolioVolatility(normalised, covariance);
    const riskFree = pct(v, 'riskFree');
    const sharpe = er !== null && vol !== null && vol > 0 ? (er - riskFree) / vol : null;
    const hhi = concentrationHHI(normalised);
    return res(
      [
        out('Expected portfolio return', PCT(er), 'percent'),
        out('Portfolio volatility', PCT(vol), 'percent'),
        out('Sharpe ratio at the stated risk-free rate', sharpe === null ? null : round(sharpe, 3), 'number'),
        out('Concentration (Herfindahl index)', round(hhi, 3), 'number'),
        out('Effective number of sleeves', round(effectivePositions(normalised), 2), 'number'),
        out('Worst sleeve weight', PCT(Math.max(...normalised)), 'percent', {
          note: 'A portfolio dominated by one sleeve is diversified on paper and not in practice.',
        }),
      ],
      Math.abs(total - 1) > 0.005 ? [`The weights entered add to ${round(total * 100, 1)}% and have been scaled to 100%.`] : [],
      [
        'Volatilities and correlations are fixed assumptions built into this calculator, not estimates from data. Use the allocation analyser to test alternative correlation regimes.',
        'Rebalancing costs and the tax on realising gains are excluded.',
      ],
    );
  },

  'allocation-optimiser'(v) {
    const expected = [pct(v, 'r1'), pct(v, 'r2'), pct(v, 'r3')];
    const vols = [pct(v, 'v1'), pct(v, 'v2'), pct(v, 'v3')];
    const c12 = n(v, 'c12', 0);
    const c13 = n(v, 'c13', 0);
    const c23 = n(v, 'c23', 0);
    const correlations = [
      [1, c12, c13],
      [c12, 1, c23],
      [c13, c23, 1],
    ];
    const covariance = buildCovariance(vols, correlations);
    const riskFree = pct(v, 'riskFree');
    const minVar = minimumVarianceWeights(covariance, expected, riskFree);
    const parity = riskParityWeights(covariance);
    const equal = [1 / 3, 1 / 3, 1 / 3];
    const summary = (label: string, w: number[]): { label: string; value: string } => ({
      label,
      value: w.map((x, i) => `Asset ${i + 1}: ${round(x * 100, 1)}%`).join(' · '),
    });
    const worstCase = [minVar, parity].flatMap((o) => o.warnings).slice(0, 3);
    return res(
      [
        out('Minimum-variance portfolio volatility', PCT(minVar.volatility), 'percent'),
        out('Minimum-variance expected return', PCT(minVar.expectedReturn), 'percent'),
        out('Risk-parity portfolio volatility', PCT(parity.volatility), 'percent'),
        out('Risk-parity expected return', PCT(parity.expectedReturn), 'percent'),
        out('Equal-weight portfolio volatility', PCT(portfolioVolatility(equal, covariance)), 'percent'),
        out('Average pairwise correlation', round((c12 + c13 + c23) / 3, 3), 'number'),
      ],
      [
        ...worstCase,
        'Optimisers maximise the influence of estimation error: changing one expected return by a percentage point can move a recommended allocation by twenty points.',
        'The output is not a recommendation. A minimum-variance portfolio built from past data is fitted to the past.',
      ],
      [],
      [summary('Minimum variance', minVar.weights), summary('Risk parity', parity.weights), summary('Equal weight', equal)],
    );
  },

  sharpe(v) {
    const annualReturn = pct(v, 'portfolioReturn');
    const volatility = pct(v, 'volatility');
    const riskFree = pct(v, 'riskFree');
    const years = n(v, 'years', 1);
    const sharpe = volatility > 0 ? (annualReturn - riskFree) / volatility : null;
    const yearsNeeded = sharpe !== null && sharpe > 0 ? (1.96 / sharpe) ** 2 : null;
    return res(
      [
        out('Sharpe ratio', sharpe === null ? null : round(sharpe, 3), 'number'),
        out('Excess return over the risk-free rate', PCT(annualReturn - riskFree), 'percent'),
        out('Return per unit of volatility', sharpe === null ? null : round(sharpe / 100, 4), 'number'),
        out('Years of data needed to distinguish this from luck at 95% confidence', yearsNeeded === null ? null : round(yearsNeeded, 1), 'years', {
          tone: yearsNeeded !== null && yearsNeeded > years ? 'caution' : 'neutral',
        }),
        out('Record length supplied', years, 'years'),
      ],
      yearsNeeded !== null && yearsNeeded > years
        ? ['The record supplied is shorter than the length needed for the ratio to be statistically meaningful. The figure is an observation, not evidence of skill.']
        : [],
      [
        'Sharpe penalises upside volatility identically to downside. Use the Sortino ratio where the asymmetry matters.',
        'It assumes returns are normally distributed. Strategies that sell options or hold illiquid assets report attractive Sharpe ratios that ignore their tail risk.',
      ],
    );
  },

  sortino(v) {
    const annualReturn = pct(v, 'portfolioReturn');
    const volatility = pct(v, 'volatility');
    const target = pct(v, 'targetReturn');
    const negativeShare = pct(v, 'negativeShare');
    // Downside deviation cannot be recovered from annual volatility alone; the
    // negative-period share gives an indicative scaling and the result is
    // labelled as approximate for that reason.
    const downside = volatility * Math.sqrt(Math.max(0.01, negativeShare));
    const sortino = downside > 0 ? (annualReturn - target) / downside : null;
    const sharpeLike = volatility > 0 ? (annualReturn - target) / volatility : null;
    return res(
      [
        out('Approximate downside deviation', PCT(downside), 'percent', {
          note: 'Derived from total volatility and the share of negative periods, not from a return series.',
        }),
        out('Sortino ratio', sortino === null ? null : round(sortino, 3), 'number'),
        out('Same numerator over total volatility', sharpeLike === null ? null : round(sharpeLike, 3), 'number'),
        out('Difference attributable to ignoring upside volatility', sortino === null || sharpeLike === null ? null : round(sortino - sharpeLike, 3), 'number'),
      ],
      [
        'Downside deviation is approximated here. Enter a monthly or quarterly return series into the research workbook for the exact figure.',
        'The target return is a choice. Setting it high makes almost every strategy look poor, which is a way of rigging the metric.',
      ],
      [],
    );
  },

  'max-drawdown'(v) {
    const peak = n(v, 'peakValue', 0);
    const trough = n(v, 'troughValue', 0);
    const recovered = n(v, 'recoveredValue', 0);
    const monthsDown = Math.max(1, Math.round(n(v, 'monthsPeakToTrough', 1)));
    const monthsUp = Math.max(0, Math.round(n(v, 'monthsToRecover', 0)));
    const path: number[] = [];
    for (let m = 0; m <= monthsDown; m += 1) {
      const f = m / monthsDown;
      path.push(peak * (1 - f) + trough * f);
    }
    for (let m = 1; m <= monthsUp; m += 1) {
      const f = m / Math.max(1, monthsUp);
      path.push(trough * (1 - f) + recovered * f);
    }
    const analysis = analyseDrawdowns(path);
    const depth = peak > 0 ? trough / peak - 1 : null;
    const requiredGain = trough > 0 ? peak / trough - 1 : null;
    return res(
      [
        out('Drawdown depth', PCT(depth), 'percent', { tone: 'negative' }),
        out('Gain required to recover the peak', PCT(requiredGain), 'percent'),
        out('Months from peak to trough', monthsDown, 'number'),
        out('Months from trough back to the previous peak', monthsUp, 'number', monthsUp === 0 ? { note: 'Not regained within the period entered.' } : {}),
        out('Total time underwater', monthsDown + monthsUp, 'number'),
        out('Longest stretch below a prior peak', analysis?.longestUnderwater ?? null, 'number'),
      ],
      ['Only one drawdown is analysed. A long record contains several, and the deepest is not necessarily the most damaging to a withdrawal plan.'],
      [],
    );
  },

  'rolling-returns'(v) {
    const current = n(v, 'current', 0);
    const windows: { label: string; value: number; years: number }[] = [
      { label: 'One year', value: n(v, 'value1y', 0), years: 1 },
      { label: 'Three years', value: n(v, 'value3y', 0), years: 3 },
      { label: 'Five years', value: n(v, 'value5y', 0), years: 5 },
      { label: 'Seven years', value: n(v, 'value7y', 0), years: 7 },
    ];
    const outputs = windows
      .filter((w) => w.value > 0)
      .map((w) =>
        out(`Annualised return over ${w.label.toLowerCase()}`, PCT(cagr(w.value, current, w.years)), 'percent'),
      );
    const spread = outputs
      .map((o) => o.value)
      .filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
    const highest = spread.length > 0 ? Math.max(...spread) : null;
    const lowest = spread.length > 0 ? Math.min(...spread) : null;
    return res(
      [
        ...outputs,
        out('Highest window return', highest, 'percent'),
        out('Lowest window return', lowest, 'percent'),
        out('Range across windows', highest !== null && lowest !== null ? round(highest - lowest, 2) : null, 'percent', {
          note: 'The same investment, measured four ways.',
          tone: 'caution',
        }),
      ],
      ['Point-to-point returns are dominated by the values at two dates. Moving the start date by a month can change the annualised figure by several percentage points.'],
      ['A return over a period shorter than a year should not be annualised at all.'],
    );
  },

  'monte-carlo'(v) {
    const initial = n(v, 'initialValue', 0);
    const contribution = n(v, 'annualContribution', 0);
    const annualReturn = pct(v, 'annualReturn');
    const annualVolatility = pct(v, 'annualVolatility');
    const years = n(v, 'years', 0);
    const target = n(v, 'targetValue', 0);
    const simulations = Math.min(50_000, Math.max(100, Math.round(n(v, 'simulations', 5000))));
    const method = (v.method === 'student-t' ? 'student-t' : 'normal') as 'normal' | 'student-t';
    const result = monteCarlo({
      initialValue: initial,
      annualContribution: contribution,
      annualReturn,
      annualVolatility,
      years,
      simulations,
      method,
      ...(target > 0 ? { targetValue: target } : {}),
    });
    return res(
      [
        out('Median outcome', round(result.percentiles.p50, 0), 'currency'),
        out('25th percentile', round(result.percentiles.p25, 0), 'currency'),
        out('10th percentile', round(result.percentiles.p10, 0), 'currency'),
        out('5th percentile', round(result.percentiles.p5, 0), 'currency', {
          note: 'One run in twenty ends below this figure.',
          tone: 'caution',
        }),
        out('90th percentile', round(result.percentiles.p90, 0), 'currency'),
        out('Probability of reaching the target', target > 0 ? PCT(result.probabilityOfShortfall === null ? null : 1 - result.probabilityOfShortfall) : null, 'percent'),
        out('Gap between the median and the 5th percentile', round(result.percentiles.p50 - result.percentiles.p5, 0), 'currency', {
          note: 'This gap, not the median, is the honest measure of the plan’s risk.',
        }),
        out('Simulations run', result.simulations, 'number'),
      ],
      result.limitations,
      [
        `Method: ${method}. A fixed seed is used, so the same inputs always produce the same figures.`,
        'The output is a property of the model, not of the world.',
      ],
    );
  },

  'sequence-risk'(v) {
    const corpus = n(v, 'corpus', 0);
    const withdrawal = n(v, 'annualWithdrawal', 0);
    const average = pct(v, 'averageReturn');
    const shock = pct(v, 'earlyShock');
    const years = Math.max(5, Math.round(n(v, 'years', 25)));
    const earlyYears = Math.min(3, years);
    const remainingYears = years - earlyYears;
    const runPath = (rates: number[]): { final: number; depletedIn: number | null } => {
      let balance = corpus;
      let depletedIn: number | null = null;
      rates.forEach((r, index) => {
        if (balance <= 0) return;
        balance = Math.max(0, (balance - withdrawal) * (1 + r));
        if (balance <= 0 && depletedIn === null) depletedIn = index + 1;
      });
      return { final: balance, depletedIn };
    };
    const averagePath = runPath(new Array<number>(years).fill(average));
    // The catch-up rate preserves the overall geometric average while delivering
    // the shock in the first three years.
    const catchUp =
      remainingYears > 0
        ? ((1 + average) ** years / (1 + shock) ** earlyYears) ** (1 / remainingYears) - 1
        : average;
    const shockPath = runPath([...new Array<number>(earlyYears).fill(shock), ...new Array<number>(remainingYears).fill(catchUp)]);
    return res(
      [
        out('Final corpus with average returns throughout', round(averagePath.final, 0), 'currency'),
        out('Final corpus with a poor first three years', round(shockPath.final, 0), 'currency', {
          tone: shockPath.final < averagePath.final ? 'negative' : 'neutral',
        }),
        out('Difference caused purely by the order of returns', round(averagePath.final - shockPath.final, 0), 'currency', { tone: 'caution' }),
        out('Catch-up rate required in the remaining years', PCT(catchUp), 'percent', {
          note: 'This is what the arithmetic demands after a poor start, and it is not something an investor can arrange.',
        }),
        out('Corpus exhausted in', shockPath.depletedIn, 'years', shockPath.depletedIn === null ? { note: 'Survives the horizon even with the poor start.' } : {}),
      ],
      [
        'Two paths are not a distribution. Use the Monte Carlo simulator to see the range of outcomes.',
        'This is a deterministic stress, not a worst case. Worse sequences are possible.',
      ],
      [],
    );
  },

  'risk-of-ruin'(v) {
    const initial = n(v, 'initialValue', 0);
    const withdrawal = n(v, 'annualWithdrawal', 0);
    const annualReturn = pct(v, 'returnRate');
    const annualVolatility = pct(v, 'volatility');
    const years = Math.max(5, Math.round(n(v, 'years', 30)));
    const escalation = pct(v, 'escalation');
    const simulations = Math.min(20_000, Math.max(200, Math.round(n(v, 'simulations', 3000))));
    const rng = mulberry32(20_261_016);
    const gauss = normalSampler(rng);
    let ruined = 0;
    const depletionYears: number[] = [];
    for (let s = 0; s < simulations; s += 1) {
      let balance = initial;
      let current = withdrawal;
      let depleted: number | null = null;
      for (let y = 1; y <= years; y += 1) {
        const r = annualReturn + annualVolatility * gauss();
        balance = (balance - current) * (1 + r);
        if (balance <= 0) {
          depleted = y;
          break;
        }
        current *= 1 + escalation;
      }
      if (depleted !== null) {
        ruined += 1;
        depletionYears.push(depleted);
      }
    }
    depletionYears.sort((a, z) => a - z);
    const medianDepletion = quantile(depletionYears, 0.5);
    const ruin = ruined / simulations;
    return res(
      [
        out('Probability the corpus is exhausted', PCT(ruin), 'percent', {
          tone: ruin > 0.1 ? 'negative' : ruin > 0.05 ? 'caution' : 'positive',
        }),
        out('Median year of depletion, when depletion occurs', medianDepletion === null ? null : round(medianDepletion, 0), 'years'),
        out('First-year withdrawal rate', initial > 0 ? PCT(withdrawal / initial) : null, 'percent'),
        out('Total withdrawals in the median successful path', null, 'currency', {
          note: 'Not reported: the total depends on the path and a single figure would understate the variation.',
        }),
        out('Simulations run', simulations, 'number'),
      ],
      [
        'The simulation assumes the stated average return and volatility are correct. If the next thirty years are worse than the last thirty, the true failure rate is higher than shown.',
        'A plan with a 10% failure probability is not safe. It is a plan that fails for one household in ten.',
      ],
      ['Withdrawals escalate annually at the rate entered, which is the standard way a retirement plan is stress-tested.'],
    );
  },

  rebalancing(v) {
    const values = [n(v, 'value1', 0), n(v, 'value2', 0), n(v, 'value3', 0), n(v, 'value4', 0)];
    const targets = [pct(v, 'target1'), pct(v, 'target2'), pct(v, 'target3'), pct(v, 'target4')];
    const tolerance = n(v, 'band', 5);
    const cost = pct(v, 'costRate');
    const cgt = pct(v, 'capitalGainsTaxRate');
    const targetTotal = targets.reduce((s, t) => s + t, 0);
    if (targetTotal <= 0) {
      return res([out('Rebalancing trades', null, 'text')], ['Enter target weights before the calculation can run.'], []);
    }
    const normalisedTargets = targets.map((t) => t / targetTotal);
    const result = rebalance({
      currentValues: values,
      targetWeights: normalisedTargets,
      toleranceBand: tolerance,
      transactionCostRate: cost,
      capitalGainsTaxRate: cgt,
    });
    const steps = result.trades.map((t) => ({
      label: `Asset ${t.index + 1}`,
      value: `${t.action === 'hold' ? 'Hold' : t.action === 'buy' ? 'Buy' : 'Sell'} ₹${Math.round(Math.abs(t.tradeValue)).toLocaleString('en-IN')} · drift ${round(t.drift * 100, 1)} points`,
    }));
    return res(
      [
        out('Total portfolio value', round(result.totalValue, 0), 'currency'),
        out('Any position outside its band', result.anyBreach ? 'Yes' : 'No', 'text', {
          tone: result.anyBreach ? 'caution' : 'positive',
        }),
        out('Total turnover required', round(result.totalTurnover, 0), 'currency'),
        out('Estimated transaction cost', round(result.totalCost, 0), 'currency'),
        out('Estimated tax on realised gains', round(result.totalTax, 0), 'currency'),
        out('Cost as a share of the portfolio', result.totalValue > 0 ? PCT((result.totalCost + result.totalTax) / result.totalValue) : null, 'percent'),
      ],
      [
        'Trade sizes are computed to restore the exact target weights. In practice, rebalancing with new contributions is cheaper than selling.',
        'The tax estimate assumes the portfolio is held in a taxable account. Inside a retirement account there is no tax cost to rebalancing.',
      ],
      [],
      steps,
    );
  },

  'liquidity-coverage'(v) {
    const cash = n(v, 'cash', 0);
    const equity = n(v, 'listedEquity', 0);
    const bonds = n(v, 'bonds', 0);
    const property = n(v, 'property', 0);
    const alternatives = n(v, 'alternatives', 0);
    const monthly = n(v, 'monthlyNeeds', 0);
    const result = liquidityCoverage(cash, monthly);
    const total = cash + equity + bonds + property + alternatives;
    const buySellCurrency = (x: number): number | null => (total > 0 ? x / total : null);
    return res(
      [
        out('Months of expenses covered by cash', round(result.coverageMonths, 1), 'number', {
          tone: result.coverageMonths < 3 ? 'negative' : result.coverageMonths < 6 ? 'caution' : 'positive',
        }),
        out('Assessment', result.assessment, 'text'),
        out('Liquid share of the portfolio (cash plus bonds)', PCT((buySellCurrency(cash) ?? 0) + (buySellCurrency(bonds) ?? 0)), 'percent'),
        out('Illiquid share (property plus alternatives)', PCT((buySellCurrency(property) ?? 0) + (buySellCurrency(alternatives) ?? 0)), 'percent'),
        out('Months of expenses coverable by the full liquid sleeve', monthly > 0 ? round((cash + bonds + equity * 0.9) / monthly, 1) : null, 'number', {
          note: 'Equity is included at a haircut, because it may have to be sold at a loss.',
        }),
      ],
      [
        'Days to cash assume normal market conditions. Small-caps and unlisted positions can become untradeable at the moment cash is needed most.',
        'Selling to raise cash may realise gains and trigger tax, so the true cost of liquidity exceeds market impact alone.',
      ],
      [],
    );
  },
};

/** Compound an amount and return the real value, used by several calculators. */
export function realValue(amount: number, nominal: number, inflation: number, years: number): number | null {
  const real = realReturn(nominal, inflation);
  return real === null ? null : amount * (1 + real) ** years;
}
