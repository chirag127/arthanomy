/**
 * Calculator computations — returns and the measurement of performance.
 */
import {
  breakEvenInflation as breakEvenInflationRate,
  cagr as computeCagr,
  effectiveAnnualRate,
  lumpsumFutureValue,
  opportunityCost,
  realReturn,
  realReturnApproximation,
  sipFutureValue,
  simulateSwp,
  totalReturn,
  xirr as computeXirr,
  type CashFlow,
} from '../finance/returns';
import { postTaxAssetReturn, type AssetTaxClass } from '../tax/engine';
import { n, out, pct, res, s, round } from './types';
import type { CalcResult, InputRecord } from './types';

const PCT = (x: number | null): number | null => (x === null || !Number.isFinite(x) ? null : round(x * 100, 2));

function flowsFrom(v: InputRecord, pairs: number): CashFlow[] {
  const flows: CashFlow[] = [];
  for (let i = 1; i <= pairs; i += 1) {
    const dateRaw = s(v, `date${i}`, '');
    const amount = n(v, `amount${i}`, Number.NaN);
    if (!dateRaw || !Number.isFinite(amount) || amount === 0) continue;
    const date = new Date(`${dateRaw}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) continue;
    flows.push({ date, amount });
  }
  return flows.sort((a, z) => a.date.getTime() - z.date.getTime());
}

export const returnsCalculators: Record<string, (v: InputRecord) => CalcResult> = {
  cagr(v) {
    const begin = n(v, 'beginValue', 0);
    const end = n(v, 'endValue', 0);
    const years = n(v, 'years', 0);
    const warnings: string[] = [];
    if (begin <= 0) warnings.push('A beginning value of zero or less has no defined growth rate.');
    if (end <= 0) {
      warnings.push(
        'A total loss has no finite CAGR. The annualised rate approaches −100% but is never reached, and reporting a number here would be misleading.',
      );
    }
    const rate = begin > 0 && end > 0 && years > 0 ? computeCagr(begin, end, years) : null;
    const cumulative = begin > 0 && end > 0 ? totalReturn(begin, end) : null;
    return res(
      [
        out('Compound annual growth rate', PCT(rate), 'percent', {
          tone: rate !== null && rate < 0 ? 'negative' : 'neutral',
        }),
        out('Cumulative return', PCT(cumulative), 'percent'),
        out('Ending value per ₹1 invested', begin > 0 && end > 0 ? round(end / begin, 3) : null, 'multiple'),
      ],
      warnings,
      ['Assumes a single sum invested at the start and never added to or withdrawn from.'],
    );
  },

  xirr(v) {
    const flows = flowsFrom(v, 4);
    const warnings: string[] = [];
    if (flows.length < 2) {
      warnings.push('At least two non-zero dated cash flows are needed; enter both contributions and the terminal value.');
      return res([out('XIRR', null, 'percent')], warnings, []);
    }
    const hasPositive = flows.some((f) => f.amount > 0);
    const hasNegative = flows.some((f) => f.amount < 0);
    if (!hasPositive || !hasNegative) {
      warnings.push(
        'Every cash flow has the same sign. A return exists only when money goes out and comes back, so add the current or terminal value as a positive flow.',
      );
    }
    const result = computeXirr(flows);
    if (result.warning) warnings.push(result.warning);
    if (!result.converged) {
      warnings.push('The solver did not converge on a rate for this cash-flow pattern; the figure shown is the closest value found.');
    }
    const first = flows[0];
    const last = flows[flows.length - 1];
    const spanYears =
      first && last ? (last.date.getTime() - first.date.getTime()) / (365 * 86_400_000) : Number.NaN;
    return res(
      [
        out('XIRR (money-weighted annual return)', PCT(result.rate), 'percent'),
        out('Method', result.method, 'text'),
        out('Net present value at that rate', result.npvAtSolution === null ? null : round(result.npvAtSolution, 2), 'number'),
        out('Cash flows used', flows.length, 'number'),
        out('Period covered', Number.isFinite(spanYears) ? round(spanYears, 2) : null, 'years'),
      ],
      warnings,
      [
        'XIRR weights each rupee by the time it was invested, which is why it differs from the CAGR of the same beginning and ending amounts.',
        'For periods shorter than about a year, an annualised rate is misleading and should not be quoted.',
      ],
    );
  },

  sip(v) {
    const monthly = n(v, 'monthly', 0);
    const rate = pct(v, 'rate');
    const years = n(v, 'years', 0);
    const timing = s(v, 'timing', 'begin') === 'end' ? 'end' : 'begin';
    const result = sipFutureValue(monthly, rate, years, { timing });
    return res(
      [
        out('Future value', round(result.futureValue, 0), 'currency'),
        out('Total invested', round(result.totalInvested, 0), 'currency'),
        out('Gain', round(result.totalGain, 0), 'currency', {
          tone: result.totalGain >= 0 ? 'positive' : 'negative',
        }),
        out('Absolute return on money invested', PCT(result.absoluteReturn), 'percent'),
      ],
      [],
      [
        `Contributions are assumed to be made at the ${timing === 'begin' ? 'start' : 'end'} of each month.`,
        'A constant return is assumed. Real returns arrive unevenly, and the sequence changes the outcome.',
        'Taxes and exit loads are not deducted.',
      ],
    );
  },

  'step-up-sip'(v) {
    const monthly = n(v, 'monthly', 0);
    const stepUp = n(v, 'stepUp', 0);
    const rate = pct(v, 'rate');
    const years = n(v, 'years', 0);
    const flat = sipFutureValue(monthly, rate, years, { timing: 'begin' });
    const stepped = sipFutureValue(monthly, rate, years, { timing: 'begin', annualStepUpPercent: stepUp });
    return res(
      [
        out('Future value with step-up', round(stepped.futureValue, 0), 'currency'),
        out('Total invested with step-up', round(stepped.totalInvested, 0), 'currency'),
        out('Future value without step-up', round(flat.futureValue, 0), 'currency'),
        out('Extra invested because of the step-up', round(stepped.totalInvested - flat.totalInvested, 0), 'currency'),
        out('Extra corpus per extra rupee invested', flat.totalInvested > 0 && stepped.totalInvested > flat.totalInvested
          ? round((stepped.futureValue - flat.futureValue) / (stepped.totalInvested - flat.totalInvested), 2)
          : null, 'multiple'),
      ],
      [],
      ['The step-up is applied once a year on the anniversary of the first instalment.'],
    );
  },

  lumpsum(v) {
    const principal = n(v, 'principal', 0);
    const rate = pct(v, 'rate');
    const years = n(v, 'years', 0);
    const compounds = Number.parseInt(s(v, 'frequency', '1'), 10) || 1;
    const result = lumpsumFutureValue(principal, rate, years, { compoundsPerYear: compounds });
    const ear = effectiveAnnualRate(rate, compounds);
    return res(
      [
        out('Future value', round(result.futureValue, 0), 'currency'),
        out('Gain', round(result.gain, 0), 'currency'),
        out('Multiple of the amount invested', result.multiple === null ? null : round(result.multiple, 2), 'multiple'),
        out('Effective annual rate for this compounding frequency', PCT(ear), 'percent', {
          note: 'Compare investments on this figure, never on the nominal rate.',
        }),
        out('Years to double at this rate', rate > 0 ? round(Math.log(2) / Math.log(1 + ear), 1) : null, 'years'),
      ],
      [],
      ['Assumes the rate is unchanged for the whole period and no tax or expense is deducted.'],
    );
  },

  swp(v) {
    const corpus = n(v, 'corpus', 0);
    const withdrawalRate = pct(v, 'withdrawalRate');
    const returnRate = pct(v, 'returnRate');
    const years = n(v, 'years', 0);
    const escalation = n(v, 'escalation', 0);
    const result = simulateSwp(corpus, withdrawalRate, returnRate, years, { inflationEscalation: escalation });
    const warnings = result.warning ? [result.warning] : [];
    return res(
      [
        out('First-year withdrawal', round(corpus * withdrawalRate, 0), 'currency'),
        out('Balance after the projection period', round(result.finalBalance, 0), 'currency', {
          tone: result.depleted ? 'negative' : 'positive',
        }),
        out('Total withdrawn', round(result.totalWithdrawn, 0), 'currency'),
        out('Corpus exhausted in', result.depletedInYears === null ? null : result.depletedInYears, 'years', result.depletedInYears === null ? { note: 'The corpus survives the horizon in this model.' } : {}),
      ],
      warnings,
      [`Withdrawals rise ${escalation}% a year in this model.`],
    );
  },

  'real-return'(v) {
    const nominal = pct(v, 'nominal');
    const inflation = pct(v, 'inflation');
    const years = n(v, 'years', 0);
    const exact = realReturn(nominal, inflation);
    const approx = realReturnApproximation(nominal, inflation);
    const realMultiple = exact === null ? null : (1 + exact) ** years;
    return res(
      [
        out('Exact real return', PCT(exact), 'percent'),
        out('Nominal minus inflation (the approximation)', PCT(approx), 'percent', {
          note: 'The approximation overstates the real return whenever rates are positive.',
        }),
        out('Error in the approximation', exact === null ? null : round((approx - exact) * 100, 2), 'percent'),
        out('Real value of ₹1 after the period', realMultiple === null ? null : round(realMultiple, 3), 'multiple'),
      ],
      [],
      [
        'Inflation here is a national average. Your own inflation depends on what you buy.',
        'Taxes are excluded. A 7% deposit with 6% inflation and a 30% slab rate has a negative real return.',
      ],
    );
  },

  'nominal-vs-real'(v) {
    const amount = n(v, 'amount', 0);
    const nominal = pct(v, 'nominal');
    const inflation = pct(v, 'inflation');
    const years = n(v, 'years', 0);
    const nominalValue = amounts(amount, nominal, years);
    const realValue = amounts(amount, inflation, years);
    const futureCost = amounts(amount, inflation, years);
    return res(
      [
        out('Nominal value at the end', round(nominalValue, 0), 'currency'),
        out('Purchasing power of that value, in today’s money', round(realValue, 0), 'currency'),
        out('Gain in nominal terms', PCT(realReturn(nominal, 0)), 'percent'),
        out('Gain in purchasing power', PCT(realReturn(nominal, inflation)), 'percent'),
        out('What ₹' + round(amount, 0) + ' of spending costs then', round(futureCost, 0), 'currency'),
      ],
      [],
      ['Uses a single inflation rate for the whole period, which no actual economy provides.'],
    );
  },

  'post-tax-return'(v) {
    const taxClass = s(v, 'taxClass', 'equity-listed') as AssetTaxClass;
    const grossReturn = pct(v, 'grossReturn');
    const holdingYears = n(v, 'holdingYears', 0);
    const marginalSlabRate = pct(v, 'marginalSlabRate');
    const totalIncome = n(v, 'totalIncome', 0);
    const result = postTaxAssetReturn({
      assetLabel: taxClass,
      taxClass,
      grossReturn,
      holdingYears,
      marginalSlabRate,
      totalIncome,
    });
    return res(
      [
        out('Pre-tax terminal multiple', round(result.preTaxTerminalMultiple, 3), 'multiple'),
        out('Post-tax terminal multiple', round(result.postTaxTerminalMultiple, 3), 'multiple'),
        out('Annualised post-tax return', PCT(result.annualisedPostTaxReturn), 'percent'),
        out('Effective tax rate on the gain', PCT(result.effectiveTaxRateOnGain), 'percent'),
        out('Tax treatment applied', result.taxTreatment, 'text'),
      ],
      result.taxTreatment.includes('provisional') ? ['The treatment of this asset class is marked provisional.'] : [],
      result.notes.length > 0 ? result.notes : [`Rules applied are those in force for FY 2025-26 (AY 2026-27).`],
    );
  },

  'taxable-equivalent-yield'(v) {
    const taxFree = pct(v, 'taxFreeYield');
    const marginal = pct(v, 'marginalRate');
    const equivalent = marginal >= 1 ? null : taxFree / (1 - marginal);
    return res(
      [
        out('Taxable-equivalent yield', PCT(equivalent), 'percent', {
          note: 'A taxable instrument must offer at least this much to match the exempt one.',
        }),
        out('Advantage from the exemption', equivalent === null ? null : round((equivalent - taxFree) * 100, 2), 'percent'),
        out('The same exemption for a nil-rate investor', PCT(taxFree), 'percent', {
          note: 'At a 0% marginal rate the exemption is worth nothing.',
        }),
      ],
      marginal >= 1 ? ['A marginal rate of 100% makes the comparison undefined.'] : [],
      [
        'Compares income taxed every year. It is not the right comparison for an instrument taxed only on capital gains at the end.',
        'Lock-in, contribution ceilings and withdrawal rules are not captured here.',
      ],
    );
  },

  'expense-ratio-impact'(v) {
    const amount = n(v, 'amount', 0);
    const gross = pct(v, 'grossReturn');
    const high = pct(v, 'expenseRatio');
    const years = n(v, 'years', 0);
    const low = pct(v, 'directExpenseRatio');
    const highValue = amount * (1 + gross - high) ** years;
    const lowValue = amount * (1 + gross - low) ** years;
    const noFeeValue = amount * (1 + gross) ** years;
    return res(
      [
        out('Value with the higher expense ratio', round(highValue, 0), 'currency'),
        out('Value with the lower expense ratio', round(lowValue, 0), 'currency'),
        out('Difference', round(lowValue - highValue, 0), 'currency', { tone: 'caution' }),
        out('Cost of the higher fee, as a share of the final corpus', noFeeValue > 0 ? round((noFeeValue - highValue) / noFeeValue, 4) : null, 'percent'),
        out('Annual fee difference', round((high - low) * 100, 2), 'percent'),
      ],
      [],
      [
        'The fee is charged on a growing balance, so the cumulative rupee cost is not the annual fee multiplied by the number of years.',
        'Brokerage, impact cost and the fund’s own transaction costs sit outside the published expense ratio.',
      ],
    );
  },

  'tracking-error'(v) {
    const fundReturn = pct(v, 'fundReturn');
    const indexReturn = pct(v, 'indexReturn');
    const expenseRatio = pct(v, 'expenseRatio');
    const daily = pct(v, 'trackingErrorDaily');
    const difference = fundReturn - indexReturn;
    const residual = difference + expenseRatio;
    return res(
      [
        out('Tracking difference', PCT(difference), 'percent', {
          note: 'The realised gap between the fund and its index over the period.',
        }),
        out('Explained by the expense ratio', PCT(-expenseRatio), 'percent'),
        out('Unexplained residual', PCT(residual), 'percent', {
          note: 'Cash drag, sampling, transaction costs, or an error in the comparison.',
          tone: Math.abs(residual) > 0.005 ? 'caution' : 'neutral',
        }),
        out('Annualised tracking error', PCT(daily * Math.sqrt(252)), 'percent', {
          note: 'Assumes 252 trading days and that the reported tracking error is a daily figure.',
        }),
      ],
      [],
      [
        'Tracking difference and tracking error are different quantities. A fund can track closely and still lag consistently.',
        'Compare against a total-return index. A price index cannot be tracked by a fund that receives dividends.',
      ],
    );
  },

  'opportunity-cost'(v) {
    const amount = n(v, 'amount', 0);
    const alternative = pct(v, 'alternativeReturn');
    const years = n(v, 'years', 0);
    const result = opportunityCost(amount, alternative, years);
    return res(
      [
        out('Value in the alternative investment', round(result.finalValue, 0), 'currency'),
        out('Value forgone', round(result.foregoneValue, 0), 'currency', { tone: 'caution' }),
        out('Multiple of the amount held', amount > 0 ? round(result.finalValue / amount, 2) : null, 'multiple'),
      ],
      ['The alternative is hypothetical and would have carried risk. This is a discipline for thinking about idle cash, not evidence that the alternative was certain.'],
      [],
    );
  },

  'break-even-inflation'(v) {
    const nominal = pct(v, 'nominal');
    const inflation = pct(v, 'inflation');
    const realTarget = pct(v, 'realTarget');
    const breakEven = breakEvenInflationRate(nominal);
    const required = (1 + realTarget) * (1 + inflation) - 1;
    const actualReal = realReturn(nominal, inflation);
    return res(
      [
        out('Inflation that exactly wipes out this return', PCT(breakEven), 'percent', {
          note: 'Above this inflation rate the real return is negative; below it, positive.',
        }),
        out('Return required to earn the real target', PCT(required), 'percent'),
        out('Real return actually earned at the assumed inflation', PCT(actualReal), 'percent', {
          tone: actualReal !== null && actualReal < 0 ? 'negative' : 'neutral',
        }),
      ],
      [],
      [
        'Taxes are excluded. At a 31.2% all-in marginal rate a 7% deposit nets 4.82% and needs inflation below that to preserve purchasing power.',
      ],
    );
  },

  'purchasing-power'(v) {
    const amount = n(v, 'amount', 0);
    const inflation = pct(v, 'inflation');
    const years = n(v, 'years', 0);
    const futureCost = amounts(amount, inflation, years);
    return res(
      [
        out('Cost of the same basket in the future', round(futureCost, 0), 'currency'),
        out('Increase', round(futureCost - amount, 0), 'currency'),
        out('Multiple of today’s cost', round(futureCost / Math.max(1, amount), 2), 'multiple'),
        out('Purchasing power of ₹' + round(amount, 0) + ' in that future year', round(amount / (1 + inflation) ** years, 0), 'currency'),
      ],
      [],
      ['Education, healthcare and rent have historically risen faster than the headline consumer price index in India. Use a category-specific rate where one is available.'],
    );
  },

  'dividend-return'(v) {
    const initialPrice = n(v, 'initialPrice', 0);
    const finalPrice = n(v, 'finalPrice', 0);
    const initialYield = pct(v, 'dividendYield');
    const dividendGrowth = pct(v, 'dividendGrowth');
    const years = n(v, 'years', 0);
    let dividend = initialPrice * initialYield;
    let reinvestedValue = finalPrice; // terminal value excludes cash dividends already paid
    let totalDividends = 0;
    for (let y = 0; y < years; y += 1) {
      totalDividends += dividend;
      // Dividends are assumed reinvested at the price appreciation rate.
      const priceGrowth = years > 0 && initialPrice > 0 ? (finalPrice / initialPrice) ** (1 / years) - 1 : 0;
      reinvestedValue += dividend * (1 + priceGrowth) ** (years - y - 1);
      dividend *= 1 + dividendGrowth;
    }
    const priceOnly = initialPrice > 0 ? (finalPrice / initialPrice) ** (1 / Math.max(1, years)) - 1 : null;
    const total = initialPrice > 0 && years > 0 ? (reinvestedValue / initialPrice) ** (1 / years) - 1 : null;
    return res(
      [
        out('Price appreciation alone (annualised)', PCT(priceOnly), 'percent'),
        out('Total return with dividends reinvested', PCT(total), 'percent'),
        out('Dividends received over the period', round(totalDividends, 2), 'currency'),
        out('Terminal value with dividends reinvested', round(reinvestedValue, 2), 'currency'),
      ],
      [],
      [
        'Dividends are taxed in the year received, so the post-tax reinvestment rate is below the gross rate used here.',
        'The reinvestment price is assumed to grow at the same rate as the share over the whole period.',
      ],
    );
  },

  'inflation-adjusted-return'(v) {
    const realTarget = pct(v, 'realTarget');
    const inflation = pct(v, 'inflation');
    const tax = pct(v, 'marginalRate');
    const available = pct(v, 'availableReturn');
    const years = n(v, 'years', 0);
    const requiredPreTax = tax >= 1 ? null : ((1 + realTarget) * (1 + inflation)) / (1 - tax) - 1;
    const availablePostTax = realReturn(available * (1 - tax), inflation);
    const shortfall = requiredPreTax === null ? null : requiredPreTax - available;
    return res(
      [
        out('Nominal pre-tax return required', PCT(requiredPreTax), 'percent'),
        out('Return currently available', PCT(available), 'percent'),
        out('Shortfall against the required return', shortfall === null ? null : round(shortfall * 100, 2), 'percent', {
          tone: shortfall !== null && shortfall > 0 ? 'negative' : 'positive',
        }),
        out('Real post-tax return from the available option', PCT(availablePostTax), 'percent'),
        out('Real value multiple over the horizon', availablePostTax === null ? null : round((1 + availablePostTax) ** years, 2), 'multiple'),
      ],
      requiredPreTax !== null && requiredPreTax > 0.15
        ? ['A required return above about 15% nominal is a demanding constraint. Treat it as a signal that either the goal or the assumption needs revisiting, rather than that a riskier product is needed.']
        : [],
      [
        'Assumes the return is taxed annually at the marginal rate. An investment taxed only on capital gains at exit needs a lower nominal return.',
        'The required return is a constraint on what you need, not a statement about what the market will provide.',
      ],
    );
  },
};

/** Compound an amount at a constant annual rate. */
function amounts(amount: number, rate: number, years: number): number {
  return amount * (1 + rate) ** years;
}
