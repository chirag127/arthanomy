/**
 * Calculator computations — planning, protection and statutory schemes.
 */
import { requiredMonthlyInvestment } from '../finance/portfolio';
import { cagr, lumpsumFutureValue, simulateSwp, sipFutureValue } from '../finance/returns';
import { n, out, pct, res, round } from './types';
import type { CalcResult, InputRecord } from './types';

const PCT = (x: number | null): number | null => (x === null || !Number.isFinite(x) ? null : round(x * 100, 2));

/** Compound a series of annual deposits to a maturity year. */
function depositSeries(annualDeposit: number, rate: number, depositYears: number, maturityYears: number): number {
  let value = 0;
  for (let y = 0; y < depositYears; y += 1) {
    value = (value + annualDeposit) * (1 + rate);
  }
  // Years after the final deposit, with no further contributions.
  return value * (1 + rate) ** Math.max(0, maturityYears - depositYears);
}

export const planningCalculators: Record<string, (v: InputRecord) => CalcResult> = {
  'emergency-fund'(v) {
    const monthlyExpenses = n(v, 'monthlyExpenses', 0);
    const liquids = n(v, 'liquidAssets', 0);
    const nearLiquid = n(v, 'nearLiquidAssets', 0);
    const obligations = n(v, 'monthlyObligations', 0);
    const monthsToReplace = n(v, 'incomeStability', 4);
    const monthlyNeed = monthlyExpenses + obligations;
    const targetMonths = monthsToReplace + 3;
    const target = monthlyNeed * targetMonths;
    const coverage = monthlyNeed > 0 ? liquids / monthlyNeed : Number.POSITIVE_INFINITY;
    return res(
      [
        out('Monthly need (expenses plus loan repayments)', round(monthlyNeed, 0), 'currency'),
        out('Months covered by same-day assets', round(coverage, 1), 'number', {
          tone: coverage < 3 ? 'negative' : coverage < 6 ? 'caution' : 'positive',
        }),
        out('Months covered including near-liquid assets', monthlyNeed > 0 ? round((liquids + nearLiquid) / monthlyNeed, 1) : null, 'number'),
        out('Suggested target', round(target, 0), 'currency', {
          note: `Roughly ${targetMonths} months of mandatory outflows, allowing for the time it may take to replace income.`,
        }),
        out('Shortfall against the target', round(Math.max(0, target - liquids - nearLiquid), 0), 'currency', {
          tone: target - liquids - nearLiquid > 0 ? 'caution' : 'positive',
        }),
      ],
      [],
      [
        'A credit card is not an emergency fund. It converts a cash-flow problem into a debt problem at a much higher cost.',
        'Equity funds are accessible within days but may have to be sold at a loss in precisely the circumstances that create the emergency.',
      ],
    );
  },

  'goal-planning'(v) {
    const target = n(v, 'targetAmount', 0);
    const current = n(v, 'currentSavings', 0);
    const inflation = pct(v, 'inflation');
    const returnRate = pct(v, 'returnRate');
    const years = n(v, 'years', 0);
    const stepUp = n(v, 'stepUp', 0);
    const futureTarget = target * (1 + inflation) ** years;
    const plan = requiredMonthlyInvestment(futureTarget, current, returnRate, years, { annualStepUpPercent: stepUp });
    const flat = requiredMonthlyInvestment(futureTarget, current, returnRate, years, { annualStepUpPercent: 0 });
    return res(
      [
        out('Goal cost in future rupees', round(futureTarget, 0), 'currency'),
        out('Inflation component of the goal', round(futureTarget - target, 0), 'currency'),
        out('Monthly investment required with step-up', round(plan.monthlyInvestment, 0), 'currency'),
        out('Monthly investment required without step-up', round(flat.monthlyInvestment, 0), 'currency'),
        out('Total you will invest', round(plan.totalInvested, 0), 'currency'),
        out('Growth assumed to supply the rest', round(plan.totalGrowth, 0), 'currency'),
      ],
      [
        'The answer rests entirely on two assumptions — the return and the inflation rate — and both will be wrong. Review the plan annually against actual progress.',
        'A goal stated in today’s prices must be inflated. Ignoring this understates the requirement by more than a third over fifteen years at 6% inflation.',
      ],
      [plan.note],
    );
  },

  'retirement-corpus'(v) {
    const currentAge = n(v, 'currentAge', 0);
    const retirementAge = n(v, 'retirementAge', 0);
    const monthly = n(v, 'monthlyExpenses', 0);
    const inflation = pct(v, 'inflation');
    const preReturn = pct(v, 'preRetirementReturn');
    const postReturn = pct(v, 'postRetirementReturn');
    const planToAge = n(v, 'lifeExpectancy', 85);
    const existing = n(v, 'existingCorpus', 0);
    const yearsToRetirement = Math.max(0, retirementAge - currentAge);
    const retirementYears = Math.max(1, planToAge - retirementAge);
    const annualNeedAtRetirement = monthly * 12 * (1 + inflation) ** yearsToRetirement;
    let corpus = 0;
    for (let t = 1; t <= retirementYears; t += 1) {
      const spend = annualNeedAtRetirement * (1 + inflation) ** (t - 1);
      corpus += spend / (1 + postReturn) ** t;
    }
    const existingGrowth = existing * (1 + preReturn) ** yearsToRetirement;
    const shortfall = Math.max(0, corpus - existingGrowth);
    const monthlyRequired =
      yearsToRetirement > 0
        ? requiredMonthlyInvestment(shortfall, 0, preReturn, yearsToRetirement).monthlyInvestment
        : shortfall;
    return res(
      [
        out('Corpus required at retirement', round(corpus, 0), 'currency'),
        out('Monthly spending at retirement, in the rupees of that year', round(annualNeedAtRetirement / 12, 0), 'currency'),
        out('Existing savings projected to retirement', round(existingGrowth, 0), 'currency'),
        out('Shortfall', round(shortfall, 0), 'currency', { tone: shortfall > 0 ? 'caution' : 'positive' }),
        out('Monthly investment required to close it', round(monthlyRequired, 0), 'currency'),
        out('Years of withdrawals the corpus must fund', retirementYears, 'years'),
      ],
      [
        'Assumes expenses grow with general inflation. Healthcare costs in retirement typically grow faster.',
        'Taxes on withdrawals are excluded. For a debt-heavy post-retirement corpus they are charged at slab rates every year.',
        'Spending rarely stays flat in real terms: it usually falls in the early retirement years and rises again for healthcare.',
      ],
      ['The corpus is the present value of an inflation-linked spending stream discounted at the post-retirement return — the standard actuarial approach, with all its assumptions exposed.'],
    );
  },

  'annuity-vs-swp'(v) {
    const corpus = n(v, 'corpus', 0);
    const annuityShare = pct(v, 'annuityShare');
    const annuityRate = pct(v, 'annuityRate');
    const withdrawalRate = pct(v, 'withdrawalRate');
    const returnRate = pct(v, 'returnRate');
    const years = n(v, 'years', 0);
    const escalation = n(v, 'escalation', 0);
    const annuitised = corpus * annuityShare;
    const annuityIncome = annuitised * annuityRate;
    const swp = simulateSwp(corpus, withdrawalRate, returnRate, years, { inflationEscalation: escalation });
    const firstWithdrawal = corpus * withdrawalRate;
    return res(
      [
        out('Amount annuitised', round(annuitised, 0), 'currency'),
        out('Annual annuity income', round(annuityIncome, 0), 'currency'),
        out('Monthly equivalent', round(annuityIncome / 12, 0), 'currency'),
        out('First-year withdrawal from the alternative', round(firstWithdrawal, 0), 'currency'),
        out('Corpus remaining after the comparison period', round(swp.finalBalance, 0), 'currency', {
          note: 'The annuity leaves nothing to heirs unless a return-of-purchase-price option was chosen at a lower rate.',
        }),
        out('Total withdrawn over the period', round(swp.totalWithdrawn, 0), 'currency'),
        out('Corpus exhausted in', swp.depletedInYears, 'years', swp.depletedInYears === null ? { note: 'Survives the period in this model.' } : {}),
      ],
      [
        'An annuity transfers longevity and investment risk at a cost embedded in the rate rather than disclosed. Comparing the annuity rate with a bond yield understates that cost.',
        'Indian annuity markets are thin: the rate available depends on the provider, the option chosen and the timing.',
        'The withdrawal figures assume a constant return; the annuity figures assume the insurer remains solvent for decades.',
      ],
      [],
    );
  },

  'ppf-calculator'(v) {
    const deposit = n(v, 'annualDeposit', 0);
    const rate = pct(v, 'rate');
    const years = Math.max(1, Math.round(n(v, 'years', 15)));
    const depositYears = Math.min(15, years);
    const maturity = depositSeries(deposit, rate, depositYears, years);
    const totalInvested = deposit * depositYears;
    return res(
      [
        out('Maturity value', round(maturity, 0), 'currency'),
        out('Total deposited', round(totalInvested, 0), 'currency'),
        out('Interest earned', round(maturity - totalInvested, 0), 'currency'),
        out('Effective annual return', PCT(cagr(totalInvested > 0 ? totalInvested / depositYears : 0, maturity / Math.max(1, depositYears), years)), 'percent', {
          note: 'Not comparable with a single lump-sum return because the deposits were made over time.',
        }),
        out('Deposits made', depositYears, 'number'),
      ],
      ['The interest rate is declared quarterly and is not fixed for the term. It has fallen over long stretches.'],
      [
        'Deposits and interest are both exempt from tax, and the maturity proceeds are exempt as well.',
        'The annual deposit ceiling prevents the tax advantage from being scaled beyond the limit.',
      ],
    );
  },

  'epf-calculator'(v) {
    const basic = n(v, 'monthlyBasic', 0);
    const employeeRate = pct(v, 'employeeRate');
    const employerRate = pct(v, 'employerRate');
    const currentBalance = n(v, 'currentBalance', 0);
    const rate = pct(v, 'returnRate');
    const years = Math.max(1, Math.round(n(v, 'yearsToRetirement', 25)));
    const growth = pct(v, 'salaryGrowth');
    let balance = currentBalance;
    let salary = basic;
    let contributed = 0;
    for (let y = 1; y <= years; y += 1) {
      for (let m = 0; m < 12; m += 1) {
        const monthly = salary * (employeeRate + employerRate);
        balance = (balance + monthly) * (1 + rate / 12);
        contributed += monthly;
      }
      salary *= 1 + growth;
    }
    return res(
      [
        out('Projected corpus at retirement', round(balance, 0), 'currency'),
        out('Contributions over the period', round(contributed, 0), 'currency'),
        out('Interest component', round(balance - currentBalance - contributed, 0), 'currency'),
        out('First-year monthly contribution', round(basic * (employeeRate + employerRate), 0), 'currency'),
        out('Monthly contribution in the final year', round(salary * (employeeRate + employerRate), 0), 'currency'),
      ],
      [
        'The EPF interest rate is declared annually by the Employees’ Provident Fund Organisation and is not contractual. The rate used here is an assumption.',
        'Of the employer’s contribution, 8.33% of wages up to the statutory ceiling is diverted to the pension scheme and is not part of this balance.',
        'Salary growth dominates the projection over long horizons. Treat the result as an illustration of mechanics, not a forecast.',
      ],
      [],
    );
  },

  'nps-calculator'(v) {
    const monthly = n(v, 'monthlyContribution', 0);
    const rate = pct(v, 'returnRate');
    const years = n(v, 'yearsToRetirement', 0);
    const existing = n(v, 'currentCorpus', 0);
    const annuityShare = pct(v, 'annuityShare');
    const annuityRate = pct(v, 'annuityRate');
    const accumulation = sipFutureValue(monthly, rate, years, { timing: 'begin' });
    const corpus = accumulation.futureValue + existing * (1 + rate) ** years;
    const annuityPortion = corpus * annuityShare;
    const lumpSum = corpus - annuityPortion;
    return res(
      [
        out('Projected corpus at retirement', round(corpus, 0), 'currency'),
        out('Amount that must be annuitised', round(annuityPortion, 0), 'currency'),
        out('Lump sum available', round(lumpSum, 0), 'currency'),
        out('Annual pension from the annuity', round(annuityPortion * annuityRate, 0), 'currency'),
        out('Monthly pension', round((annuityPortion * annuityRate) / 12, 0), 'currency'),
        out('Pension as a share of the corpus', PCT(annuityRate * annuityShare), 'percent', {
          note: 'The annuitisation requirement is the most consequential design feature of the scheme and is frequently understated.',
        }),
        out('Total contributed', round(accumulation.totalInvested, 0), 'currency'),
      ],
      [
        'Annuity rates available at retirement are unknowable today. A one-percentage-point difference changes the pension materially.',
        'The investment choice within NPS determines the return. The default lifecycle option automatically reduces equity exposure as retirement approaches, lowering both risk and expected return.',
        'Tax treatment depends on the regime and on the share withdrawn as a lump sum, which has changed repeatedly. Verify the rule in force for the year of withdrawal.',
      ],
      [],
    );
  },

  'sukanya-samriddhi'(v) {
    const deposit = n(v, 'annualDeposit', 0);
    const rate = pct(v, 'rate');
    const depositYears = 15;
    const maturity = depositSeries(deposit, rate, depositYears, 21);
    const totalInvested = deposit * depositYears;
    return res(
      [
        out('Maturity value at 21 years from opening', round(maturity, 0), 'currency'),
        out('Total deposited', round(totalInvested, 0), 'currency'),
        out('Interest earned', round(maturity - totalInvested, 0), 'currency'),
        out('Years without deposits before maturity', 6, 'years'),
      ],
      [
        'The rate is set quarterly by the government and is not contractual for the life of the account.',
        'Withdrawals are permitted only for specified purposes, and the account is tied to a girl child as prescribed by the scheme rules.',
      ],
      ['Deposits are exempt, the interest is exempt and the maturity proceeds are exempt, which is worth most to a parent on a high slab rate.'],
    );
  },

  'term-insurance-need'(v) {
    const income = n(v, 'annualIncome', 0);
    const yearsToReplace = n(v, 'yearsToReplace', 0);
    const loans = n(v, 'outstandingLoans', 0);
    const goals = n(v, 'futureGoals', 0);
    const liquids = n(v, 'liquidAssets', 0);
    const existing = n(v, 'existingCover', 0);
    const inflation = pct(v, 'inflation');
    const undiscounted = income * yearsToReplace;
    // Discounting the replacement income at inflation makes the requirement the
    // present value of a real annuity — the honest version of an income multiple.
    let discounted = 0;
    for (let t = 0; t < yearsToReplace; t += 1) {
      discounted += income / (1 + inflation) ** t;
    }
    const requirement = discounted + loans + goals - liquids - existing;
    return res(
      [
        out('Cover required (income replaced in real terms)', round(Math.max(0, requirement / (1 + 0)), 0), 'currency'),
        out('Income replacement component, discounted', round(discounted, 0), 'currency'),
        out('Undiscounted income multiple', round(undiscounted, 0), 'currency', {
          note: 'What the simple "years of income" rule produces, before discounting.',
        }),
        out('Liabilities and future obligations', round(loans + goals, 0), 'currency'),
        out('Existing cover and liquid assets', round(existing + liquids, 0), 'currency'),
        out('Additional cover needed', round(Math.max(0, requirement), 0), 'currency', {
          tone: requirement > 0 ? 'caution' : 'positive',
        }),
      ],
      [
        'Term insurance is not an investment: it has no surrender value and pays nothing if the term ends without a claim. That is the product working as designed.',
        'Group cover provided by an employer ends with the job and should not be counted as permanent protection.',
      ],
      ['The income-replacement component is discounted for inflation rather than multiplied by a simple number of years, because the corpus can earn a return while it is being drawn down.'],
    );
  },

  'advance-tax-schedule'(v) {
    const estimatedTax = n(v, 'estimatedTax', 0);
    const tds = n(v, 'tdsDeducted', 0);
    const interestRate = pct(v, 'interestRate');
    const balance = Math.max(0, estimatedTax - tds);
    const schedule = [
      { label: 'By 15 June', cumulative: 0.15 },
      { label: 'By 15 September', cumulative: 0.45 },
      { label: 'By 15 December', cumulative: 0.75 },
      { label: 'By 15 March', cumulative: 1.0 },
    ];
    let paid = 0;
    const rows = schedule.map((s) => {
      const due = balance * s.cumulative;
      const instalment = Math.max(0, due - paid);
      paid += instalment;
      return { label: s.label, value: `Cumulative ₹${Math.round(due).toLocaleString('en-IN')} · instalment ₹${Math.round(instalment).toLocaleString('en-IN')}` };
    });
    return res(
      [
        out('Estimated annual tax', round(estimatedTax, 0), 'currency'),
        out('TDS already deducted', round(tds, 0), 'currency'),
        out('Balance payable in instalments', round(balance, 0), 'currency'),
        out('First instalment, by 15 June', round(balance * 0.15, 0), 'currency'),
        out('Second instalment, by 15 September', round(balance * 0.3, 0), 'currency'),
        out('Third instalment, by 15 December', round(balance * 0.3, 0), 'currency'),
        out('Final instalment, by 15 March', round(balance * 0.25, 0), 'currency'),
        out('Approximate monthly interest if nothing is paid', round(balance * interestRate, 0), 'currency', {
          note: 'Interest is charged for three months on each shortfall instalment, so the total cost is not this figure multiplied by twelve.',
          tone: 'caution',
        }),
      ],
      [
        'The schedule assumes income that is not entirely business income. A taxpayer with presumptive business income has a single instalment on 15 March.',
        'Interest on a shortfall is mechanical rather than discretionary; it is charged at 1% per month on each missed instalment.',
      ],
      [],
      rows,
    );
  },

  'tax-loss-harvesting'(v) {
    const stGains = n(v, 'shortTermGains', 0);
    const ltGains = n(v, 'longTermGains', 0);
    const stLosses = n(v, 'shortTermLosses', 0);
    const ltLosses = n(v, 'longTermLosses', 0);
    const stRate = pct(v, 'stcgRate');
    const ltRate = pct(v, 'ltcgRate');
    const exemptionUsed = n(v, 'exemptionAvailable', 0);
    // Statutory order: short-term losses against short-term gains, then against
    // long-term gains; long-term losses only against long-term gains.
    const stGainsAfter = Math.max(0, stGains - stLosses);
    const lossesLeft = Math.max(0, stLosses - stGains);
    const ltGainsAfterShortLosses = Math.max(0, ltGains - lossesLeft);
    const ltLossesLeft = Math.max(0, ltLosses - ltGainsAfterShortLosses);
    const taxableLt = Math.max(0, ltGainsAfterShortLosses - ltLosses);
    const exemptLt = Math.min(ltGains, exemptionUsed);
    const taxableLtAfterExemption = Math.max(0, taxableLt - exemptLt);
    const taxWithoutHarvesting = Math.max(0, stGains) * stRate + Math.max(0, ltGains - exemptionUsed) * ltRate;
    const taxWithHarvesting = stGainsAfter * stRate + taxableLtAfterExemption * ltRate;
    return res(
      [
        out('Tax before harvesting', round(taxWithoutHarvesting, 0), 'currency'),
        out('Tax after set-off', round(taxWithHarvesting, 0), 'currency'),
        out('Tax saved', round(taxWithoutHarvesting - taxWithHarvesting, 0), 'currency', { tone: 'positive' }),
        out('Short-term gains still taxable', round(stGainsAfter, 0), 'currency'),
        out('Long-term gains still taxable after exemption', round(taxableLtAfterExemption, 0), 'currency'),
        out('Long-term losses unutilised (carried forward)', round(ltLossesLeft, 0), 'currency', {
          note: 'Long-term losses can only be set against long-term gains, so they are the less valuable loss to hold.',
        }),
      ],
      [
        'Carry-forward requires the return to be filed by the due date. A belated return forfeits the carry-forward of losses entirely.',
        'India has no wash-sale rule in the form used in the United States, but a transaction without economic substance can still be challenged.',
        'The exemptions and rates applied here are those in force for FY 2025-26 (AY 2026-27) and must be re-verified for later years.',
      ],
      [],
    );
  },

  'inflation-erosion'(v) {
    const monthly = n(v, 'monthlyIncome', 0);
    const inflation = pct(v, 'inflation');
    const years = n(v, 'years', 0);
    const futureValue = monthly / (1 + inflation) ** years;
    const share = monthly > 0 ? futureValue / monthly : null;
    return res(
      [
        out('Purchasing power after the period', round(futureValue, 0), 'currency'),
        out('Share of today’s purchasing power retained', PCT(share), 'percent', {
          tone: share !== null && share < 0.5 ? 'negative' : 'caution',
        }),
        out('Purchasing power lost', PCT(share === null ? null : 1 - share), 'percent'),
        out('Income needed then to match today’s spending', round(monthly * (1 + inflation) ** years, 0), 'currency'),
        out('Annual escalation that would preserve it', round(inflation * 100, 2), 'percent'),
      ],
      ['Personal inflation for retirees is driven by healthcare, which has historically risen faster than the general index, so the erosion is usually worse than this figure.'],
      [],
    );
  },
};

/** Future value of a lump sum, exported for reuse in other calculator modules. */
export function grow(amount: number, rate: number, years: number): number {
  return lumpsumFutureValue(amount, rate, years).futureValue;
}
