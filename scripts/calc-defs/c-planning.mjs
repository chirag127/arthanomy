/**
 * Calculator definitions — batch C: portfolio construction, risk and planning.
 */

const inp = (id, label, kind, def, extra = {}) => ({ id, label, kind, default: def, ...extra });
const money = (id, label, def, extra = {}) => inp(id, label, 'currency', def, { unit: '₹', min: 0, ...extra });
const pct = (id, label, def, extra = {}) => inp(id, label, 'percent', def, { unit: '%', ...extra });
const yrs = (id, label, def, extra = {}) => inp(id, label, 'years', def, { unit: 'years', min: 0, ...extra });
const num = (id, label, def, extra = {}) => inp(id, label, 'number', def, extra);

export default [
  {
    id: 'portfolio-allocation',
    name: 'Portfolio Allocation Analyser',
    shortDescription:
      'Expected return, volatility and diversification benefit for a three-asset allocation, including the effect of correlation.',
    category: 'portfolio',
    difficulty: 'intermediate',
    formulas: [
      { latex: 'E[R_p] = \\sum w_i E[R_i]', label: 'Portfolio expected return' },
      { latex: '\\sigma_p^2 = \\sum_i \\sum_j w_i w_j \\rho_{ij} \\sigma_i \\sigma_j', label: 'Portfolio variance' },
      { latex: '\\text{Diversification ratio} = \\frac{\\sum w_i \\sigma_i}{\\sigma_p}', label: 'Diversification ratio' },
    ],
    inputs: [
      pct('w1', 'Weight: asset 1', 50, { min: 0, max: 100 }),
      pct('r1', 'Expected return: asset 1', 12, { min: -20, max: 40 }),
      pct('v1', 'Volatility: asset 1', 16, { min: 0, max: 80 }),
      pct('w2', 'Weight: asset 2', 30, { min: 0, max: 100 }),
      pct('r2', 'Expected return: asset 2', 7, { min: -20, max: 40 }),
      pct('v2', 'Volatility: asset 2', 4, { min: 0, max: 80 }),
      pct('w3', 'Weight: asset 3', 20, { min: 0, max: 100 }),
      pct('r3', 'Expected return: asset 3', 9, { min: -20, max: 40 }),
      pct('v3', 'Volatility: asset 3', 14, { min: 0, max: 80 }),
      num('c12', 'Correlation 1–2', 0.05, { min: -1, max: 1, help: 'Equity and high-grade debt in India have historically shown low but unstable correlation.' }),
      num('c13', 'Correlation 1–3', 0.7, { min: -1, max: 1 }),
      num('c23', 'Correlation 2–3', 0.1, { min: -1, max: 1 }),
    ],
    workedExample:
      'A 50/30/20 split with the inputs above has an expected return near 9.9% and a volatility near 9.8% — far below the weighted-average volatility of 12.5%, because the low correlation between components cancels some of the risk. That reduction is the only genuine free lunch in finance, and it is smaller than most people expect.',
    limitations: [
      'Correlation estimates are unstable and rise toward 1 in every crisis, exactly when diversification is needed most. The historical estimate is a starting point, not a constant.',
      'Expected returns are assumptions. This calculator propagates whatever you enter and cannot detect whether the inputs are sensible.',
    ],
    relatedCalculators: ['multi-asset', 'allocation-optimiser', 'sharpe', 'rebalancing'],
    engine: 'portfolio-allocation',
  },
  {
    id: 'multi-asset',
    name: 'Multi-Asset Portfolio',
    shortDescription:
      'A five-sleeve allocation with correlation inputs, showing return, volatility, Sharpe ratio and concentration.',
    category: 'portfolio',
    difficulty: 'advanced',
    formulas: [
      { latex: '\\text{HHI} = \\sum w_i^2', label: 'Herfindahl concentration index' },
      { latex: '\\text{Effective positions} = 1/\\text{HHI}', label: 'Effective number of holdings' },
    ],
    inputs: [
      pct('wEquity', 'Indian equity', 45, { min: 0, max: 100 }),
      pct('wDebt', 'Indian high-grade debt', 30, { min: 0, max: 100 }),
      pct('wGold', 'Gold', 10, { min: 0, max: 100 }),
      pct('wGlobal', 'Global equity', 10, { min: 0, max: 100 }),
      pct('wCash', 'Cash and liquid', 5, { min: 0, max: 100 }),
      pct('rEquity', 'Expected equity return', 11, { min: -20, max: 40 }),
      pct('rDebt', 'Expected debt return', 7, { min: -20, max: 40 }),
      pct('rGold', 'Expected gold return', 6, { min: -20, max: 40 }),
      pct('rGlobal', 'Expected global equity return (INR)', 9, { min: -20, max: 40 }),
      pct('rCash', 'Expected cash return', 4, { min: -20, max: 40 }),
      pct('riskFree', 'Risk-free rate', 6.5, { min: 0, max: 15 }),
    ],
    workedExample:
      'The allocation above, with the stated assumptions and typical Indian correlations, produces a portfolio expected return near 8.9% and volatility near 7.5%. The gold and global sleeves contribute little to return and a great deal to the reduction in volatility — which is their purpose.',
    limitations: [
      'The correlation assumptions are embedded in the model and cannot be edited here; use the allocation analyser to test alternative correlation regimes.',
      'Rebalancing costs and the tax on realising gains are excluded. In a taxable account, frequent rebalancing of the equity sleeve has a real cost.',
    ],
    relatedCalculators: ['portfolio-allocation', 'allocation-optimiser', 'currency-impact', 'rebalancing'],
    engine: 'multi-asset',
  },
  {
    id: 'allocation-optimiser',
    name: 'Allocation Optimiser',
    shortDescription:
      'Minimum-variance, risk-parity and equal-weight allocations computed side by side, with the input sensitivity stated.',
    category: 'portfolio',
    difficulty: 'expert',
    formulas: [
      { latex: '\\min_w w^T \\Sigma w \\quad \\text{s.t.} \\quad \\sum w_i = 1, \\; w_i \\ge 0', label: 'Minimum-variance problem' },
      { latex: 'w_i (\\Sigma w)_i = w_j (\\Sigma w)_j \\;\\forall i,j', label: 'Risk-parity condition: equal risk contributions' },
    ],
    inputs: [
      pct('r1', 'Expected return: asset 1', 12, { min: -20, max: 40 }),
      pct('v1', 'Volatility: asset 1', 18, { min: 0, max: 80 }),
      pct('r2', 'Expected return: asset 2', 7, { min: -20, max: 40 }),
      pct('v2', 'Volatility: asset 2', 5, { min: 0, max: 80 }),
      pct('r3', 'Expected return: asset 3', 9, { min: -20, max: 40 }),
      pct('v3', 'Volatility: asset 3', 12, { min: 0, max: 80 }),
      num('c12', 'Correlation 1–2', 0.1, { min: -1, max: 1 }),
      num('c13', 'Correlation 1–3', 0.6, { min: -1, max: 1 }),
      num('c23', 'Correlation 2–3', 0.15, { min: -1, max: 1 }),
      pct('riskFree', 'Risk-free rate', 6.5, { min: 0, max: 15 }),
    ],
    workedExample:
      'With one volatile asset and two calmer ones, minimum variance concentrates in the least volatile, risk parity spreads risk contributions more evenly, and equal weight ignores the differences entirely. Testing all three is the point: when a robust conclusion exists, all three agree.',
    limitations: [
      'Optimisers maximise the influence of estimation error. Changing one expected return by a percentage point can move the recommended allocation by twenty points.',
      'The output is not a recommendation. A minimum-variance portfolio assembled from past data is fitted to the past, and correlations in the next crisis will be higher than the inputs.',
    ],
    relatedCalculators: ['portfolio-allocation', 'multi-asset', 'monte-carlo'],
    engine: 'allocation-optimiser',
  },
  {
    id: 'sharpe',
    name: 'Sharpe Ratio Calculator',
    shortDescription: 'Excess return per unit of total volatility, with the sample size needed for the figure to be statistically meaningful.',
    category: 'risk',
    difficulty: 'intermediate',
    formulas: [
      { latex: '\\text{Sharpe} = \\frac{r_p - r_f}{\\sigma_p}', label: 'Annualised Sharpe ratio' },
      { latex: 'T \\approx \\left(\\frac{1.96}{\\text{Sharpe}}\\right)^2', label: 'Years of data needed to distinguish it from luck' },
    ],
    inputs: [
      pct('portfolioReturn', 'Annualised portfolio return', 12, { min: -50, max: 80 }),
      pct('volatility', 'Annualised volatility', 16, { min: 0.1, max: 80 }),
      pct('riskFree', 'Risk-free rate', 6.5, { min: 0, max: 20 }),
      yrs('years', 'Length of the record', 3, { min: 0.25, max: 40 }),
    ],
    workedExample:
      'A 12% return with 16% volatility and a 6.5% risk-free rate gives a Sharpe ratio of 0.34. Distinguishing that from luck at 95% confidence requires about thirty-three years of data — which is why short track records say almost nothing.',
    limitations: [
      'Sharpe penalises upside volatility identically to downside. Use Sortino when the asymmetry matters.',
      'It assumes returns are normally distributed. Strategies that sell options or hold illiquid assets show attractive Sharpe ratios that ignore their tail risk.',
    ],
    relatedCalculators: ['sortino', 'max-drawdown', 'rolling-returns'],
    engine: 'sharpe',
  },
  {
    id: 'sortino',
    name: 'Sortino Ratio Calculator',
    shortDescription: 'Excess return per unit of downside deviation only, ignoring upside volatility.',
    category: 'risk',
    difficulty: 'intermediate',
    formulas: [
      { latex: '\\text{Sortino} = \\frac{r_p - r_{target}}{\\sigma_{downside}}', label: 'Sortino ratio' },
      { latex: '\\sigma_{downside} = \\sqrt{\\frac{1}{n}\\sum \\min(0, r_t - r_{target})^2}', label: 'Downside deviation, with the divisor over all periods' },
    ],
    inputs: [
      pct('portfolioReturn', 'Annualised return', 12, { min: -50, max: 80 }),
      pct('volatility', 'Annualised total volatility', 16, { min: 0.1, max: 80 }),
      pct('targetReturn', 'Minimum acceptable return', 6, { min: -20, max: 30 }),
      pct('negativeShare', 'Share of periods with negative returns', 35, { min: 1, max: 90, help: 'Used to approximate downside deviation from total volatility.' }),
    ],
    workedExample:
      'A strategy returning 12% with 16% volatility, where only a third of periods are negative, has a materially better Sortino than Sharpe ratio — as it should, if the volatility is concentrated on the upside.',
    limitations: [
      'Downside deviation cannot be recovered exactly from annual volatility alone; the negative-period share is an approximation and the result should be read as indicative.',
      'The target return is a choice. Setting it high makes almost everything look bad, which is a common way of rigging the metric.',
    ],
    relatedCalculators: ['sharpe', 'max-drawdown', 'risk-of-ruin'],
    engine: 'sortino',
  },
  {
    id: 'max-drawdown',
    name: 'Drawdown Analyser',
    shortDescription:
      'The largest peak-to-trough decline, how long it took to recover, and the total time spent underwater.',
    category: 'risk',
    difficulty: 'intermediate',
    formulas: [
      { latex: 'DD_t = \\frac{V_t}{\\max_{s \\le t} V_s} - 1', label: 'Drawdown at time t' },
      { latex: '\\text{Max DD} = \\min_t DD_t', label: 'Maximum drawdown' },
    ],
    inputs: [
      money('peakValue', 'Peak value of the investment', 1500000, { min: 1 }),
      money('troughValue', 'Lowest value after the peak', 900000, { min: 0 }),
      money('recoveredValue', 'Value when it recovered (or current value)', 1600000, { min: 0 }),
      num('monthsPeakToTrough', 'Months from peak to trough', 11, { min: 0, max: 240 }),
      num('monthsToRecover', 'Months from trough to recovery', 26, { min: 0, max: 300, help: 'Enter the number of months until the earlier peak was regained, or 0 if it has not been regained.' }),
    ],
    workedExample:
      '₹15,00,000 falling to ₹9,00,000 is a 40% drawdown, and recovering to ₹16,00,000 means it took two years and two months to get back to the previous peak. A 40% loss requires a 67% gain to repair — a fact worth remembering before deciding that a drawdown can be tolerated.',
    limitations: [
      'Only one drawdown is analysed here. A series can contain several severe drawdowns, and the deepest is not necessarily the most damaging to a withdrawal plan.',
      'The recovery requirement rises non-linearly: a 50% loss needs a 100% gain, and a 75% loss needs a 300% gain.',
    ],
    relatedCalculators: ['risk-of-ruin', 'sharpe', 'sequence-risk'],
    engine: 'max-drawdown',
  },
  {
    id: 'rolling-returns',
    name: 'Rolling Return Comparator',
    shortDescription:
      'The same investment measured over different windows, showing how dramatically the reported annualised return depends on the period chosen.',
    category: 'returns',
    difficulty: 'intermediate',
    formulas: [
      { latex: 'r_{window} = \\left(\\frac{V_{now}}{V_{now-w}}\\right)^{1/w} - 1', label: 'Annualised return over window w' },
    ],
    inputs: [
      money('current', 'Current value', 2500000, { min: 1 }),
      money('value1y', 'Value one year ago', 2100000, { min: 0 }),
      money('value3y', 'Value three years ago', 1650000, { min: 0 }),
      money('value5y', 'Value five years ago', 1150000, { min: 0 }),
      money('value7y', 'Value seven years ago', 700000, { min: 0 }),
    ],
    workedExample:
      'The same holding shows about 19% a year over one year, 15% over three, 16.8% over five and 20% over seven. Any of those numbers could be quoted in a marketing document — which is exactly why a single window is not evidence of anything.',
    limitations: [
      'Point-to-point returns are dominated by the values at the two endpoints. Changing the start date by a month can change the reported annual figure by several percentage points.',
      'Return figures for periods under a year should not be annualised. An unusually good quarter annualises to a number that has no predictive content.',
    ],
    relatedCalculators: ['cagr', 'xirr', 'max-drawdown'],
    engine: 'rolling-returns',
  },
  {
    id: 'monte-carlo',
    name: 'Monte Carlo Simulator',
    shortDescription:
      'A distribution of possible outcomes from a stated return and volatility, reported as percentiles rather than a single projection.',
    category: 'risk',
    difficulty: 'advanced',
    formulas: [
      { latex: 'V_{t+1} = V_t (1 + \\mu + \\sigma z), \\quad z \\sim N(0,1)', label: 'Annual return draw from a normal distribution' },
      { latex: 'P(\\text{success}) = \\frac{1}{N}\\sum 1\\{V_T \\ge \\text{target}\\}', label: 'Probability of reaching the target' },
    ],
    inputs: [
      money('initialValue', 'Starting value', 2000000, { min: 0 }),
      money('annualContribution', 'Annual contribution', 300000, { min: 0 }),
      pct('annualReturn', 'Expected annual return', 11, { min: -20, max: 40 }),
      pct('annualVolatility', 'Annual volatility', 16, { min: 0, max: 80 }),
      yrs('years', 'Horizon', 20, { min: 1, max: 50 }),
      money('targetValue', 'Target value', 20000000, { min: 0 }),
      num('simulations', 'Number of simulations', 5000, { min: 100, max: 50000, help: 'A fixed seed is used so the same inputs always produce the same figure.' }),
      inp('method', 'Return distribution', 'select', 'normal', {
        options: [
          { value: 'normal', label: 'Normal (symmetric, thin tails)' },
          { value: 'student-t', label: 'Student-t (fat tails)' },
        ],
      }),
    ],
    workedExample:
      '₹20,00,000 plus ₹3,00,000 a year at 11% with 16% volatility produces a median outcome well above ₹2 crore, but the fifth percentile sits far below it. The gap between the median and the fifth percentile is the real answer to “is this plan safe?”',
    limitations: [
      'Normal draws understate the frequency of extreme years. The Student-t option fattens the tails, but no distribution fitted to the past can generate a crisis that has not yet happened.',
      'Volatility is constant in this model, so it cannot reproduce the clustering of turbulent periods that makes real drawdowns long.',
      'The output is a property of the model, not of the world.',
    ],
    relatedCalculators: ['sequence-risk', 'risk-of-ruin', 'goal-planning', 'swp'],
    engine: 'monte-carlo',
  },
  {
    id: 'sequence-risk',
    name: 'Sequence-of-Returns Risk',
    shortDescription:
      'Compares an identical average return delivered in a favourable order with the same return delivered in an unfavourable one.',
    category: 'risk',
    difficulty: 'advanced',
    formulas: [
      { latex: 'V_T = \\left(\\left(V_0 - W\\right)(1+r_1) - W\\right)(1+r_2) \\ldots', label: 'Order affects the terminal value when withdrawals occur' },
    ],
    inputs: [
      money('corpus', 'Starting corpus', 5000000, { min: 1 }),
      money('annualWithdrawal', 'Annual withdrawal', 320000, { min: 0 }),
      pct('averageReturn', 'Average annual return', 9, { min: -20, max: 30 }),
      pct('earlyShock', 'Return in the first three years', -10, { min: -60, max: 40 }),
      yrs('years', 'Horizon', 25, { min: 5, max: 45 }),
    ],
    workedExample:
      '₹50,00,000 with ₹3,20,000 withdrawn annually at a 9% average return survives twenty-five years if the early years are average or good. If the first three years deliver −10% instead, the same average return leaves a materially smaller — sometimes exhausted — corpus.',
    limitations: [
      'Two paths are not a distribution. The purpose is to demonstrate the mechanism; use the Monte Carlo simulator to see the distribution of outcomes.',
      'This is a deterministic stress, not a worst case. Worse sequences than the one entered are possible.',
    ],
    relatedCalculators: ['monte-carlo', 'swp', 'risk-of-ruin'],
    engine: 'sequence-risk',
  },
  {
    id: 'risk-of-ruin',
    name: 'Risk of Ruin',
    shortDescription:
      'The probability that a withdrawal plan exhausts the corpus, using resampled historical returns rather than a normal distribution.',
    category: 'risk',
    difficulty: 'advanced',
    formulas: [
      { latex: 'P(\\text{ruin}) = \\frac{1}{N}\\sum 1\\{\\min_t V_t \\le 0\\}', label: 'Fraction of simulated paths that hit zero' },
    ],
    inputs: [
      money('initialValue', 'Starting corpus', 5000000, { min: 1 }),
      money('annualWithdrawal', 'First-year withdrawal', 300000, { min: 0 }),
      pct('returnRate', 'Average annual return', 9, { min: -10, max: 25 }),
      pct('volatility', 'Annual volatility', 14, { min: 0, max: 60 }),
      yrs('years', 'Horizon', 30, { min: 5, max: 60 }),
      pct('escalation', 'Annual increase in withdrawal', 5, { min: 0, max: 15 }),
      num('simulations', 'Simulations', 3000, { min: 200, max: 20000 }),
    ],
    workedExample:
      'A ₹50,00,000 corpus withdrawing ₹3,00,000 in the first year and escalating 5% annually, against 9% average returns with 14% volatility, has a ruin probability well above zero over thirty years. A plan with a 10% failure probability is not safe — it is a plan that fails for one household in ten.',
    limitations: [
      'The simulation assumes the stated average return and volatility are correct. If the next thirty years have lower returns than the last, the true failure rate is higher than shown.',
      'Sequence matters, and this model captures that by construction — but it cannot capture a structural break, such as a permanent change in the tax treatment of withdrawals.',
    ],
    relatedCalculators: ['sequence-risk', 'swp', 'monte-carlo', 'retirement-corpus'],
    engine: 'risk-of-ruin',
  },
  {
    id: 'emergency-fund',
    name: 'Emergency Fund Sizing',
    shortDescription:
      'How many months of expenses your liquid assets cover, and what that implies for forced selling in a downturn.',
    category: 'planning',
    difficulty: 'foundational',
    formulas: [
      { latex: '\\text{Coverage} = \\frac{\\text{Liquid assets}}{\\text{Monthly essential expenses}}', label: 'Coverage in months' },
    ],
    inputs: [
      money('monthlyExpenses', 'Monthly essential expenses', 75000, { min: 1 }),
      money('liquidAssets', 'Same-day accessible assets', 400000, { min: 0 }),
      money('nearLiquidAssets', 'Accessible within a week', 200000, { min: 0 }),
      money('monthlyObligations', 'Monthly loan repayments', 35000, { min: 0 }),
      num('incomeStability', 'Months to find comparable work if income stopped', 4, { min: 1, max: 36 }),
    ],
    workedExample:
      '₹75,000 of monthly expenses plus ₹35,000 of loan repayments needs ₹1,10,000 a month. ₹4,00,000 in same-day assets covers under four months; adding the near-liquid bucket extends it to five and a half. A salaried borrower with a large home loan needs a larger buffer than a two-income household with no debt.',
    limitations: [
      'A credit card is not an emergency fund. It converts a cash-flow problem into a debt problem at a much higher interest cost.',
      'Equity mutual funds are accessible within days but may be sold at a loss in exactly the circumstances that create an emergency.',
    ],
    relatedCalculators: ['liquidity-coverage', 'opportunity-cost', 'emi'],
    engine: 'emergency-fund',
  },
  {
    id: 'liquidity-coverage',
    name: 'Liquidity Coverage',
    shortDescription:
      'Time to convert each holding into spendable cash, and the portfolio’s overall liquidity profile.',
    category: 'portfolio',
    difficulty: 'intermediate',
    formulas: [
      { latex: '\\text{Weighted liquidity} = \\sum w_i \\times \\text{days}_i', label: 'Weighted average days to cash' },
    ],
    inputs: [
      money('cash', 'Cash and liquid funds', 500000, { min: 0 }),
      money('listedEquity', 'Listed equity and equity funds', 3000000, { min: 0 }),
      money('bonds', 'Bonds and debt funds', 1500000, { min: 0 }),
      money('property', 'Property and illiquid assets', 5000000, { min: 0 }),
      money('alternatives', 'P2P, AIF, unlisted and other locked assets', 800000, { min: 0 }),
      money('monthlyNeeds', 'Monthly cash requirement', 100000, { min: 1 }),
    ],
    workedExample:
      'A portfolio of ₹1.08 crore with ₹5,00,000 in cash and ₹50,00,000 in property is not a liquid portfolio, however large it looks. The property cannot fund an expense; the ₹5,00,000 covers five months and no more.',
    limitations: [
      'Days to cash assume normal market conditions. Indian small-caps and unlisted positions can become untradeable at times when cash is most needed.',
      'Selling to raise cash may realise gains and trigger tax, so the effective cost of liquidity can exceed the market impact alone.',
    ],
    relatedCalculators: ['emergency-fund', 'opportunity-cost', 'max-drawdown'],
    engine: 'liquidity-coverage',
  },
  {
    id: 'goal-planning',
    name: 'Goal Planning Calculator',
    shortDescription:
      'The monthly investment required to reach a goal at a stated return, including an annual step-up.',
    category: 'planning',
    difficulty: 'foundational',
    formulas: [
      { latex: '\\text{Solve } PV(1+r)^T + P \\frac{(1+i)^{n}-1}{i}(1+i) = \\text{Target}', label: 'Required instalment, solved numerically' },
    ],
    inputs: [
      money('targetAmount', 'Goal amount (in today’s prices)', 10000000, { min: 1 }),
      money('currentSavings', 'Already saved for this goal', 500000, { min: 0 }),
      pct('inflation', 'Assumed inflation', 6, { min: 0, max: 20 }),
      pct('returnRate', 'Assumed nominal return', 11, { min: -10, max: 30 }),
      yrs('years', 'Years to the goal', 15, { min: 0.5, max: 45 }),
      pct('stepUp', 'Annual step-up in contribution', 5, { min: 0, max: 30 }),
    ],
    workedExample:
      'A goal that costs ₹1 crore today, fifteen years away with 6% inflation, is a ₹2.4 crore future bill. Saving ₹5,00,000 already and investing monthly at 11% with a 5% annual step-up requires about ₹33,000 a month to start.',
    limitations: [
      'Goals stated in today’s prices must be inflated. A goal calculator that ignores inflation understates the requirement by more than a third over fifteen years.',
      'The whole calculation rests on two assumptions, and both will be wrong. Review the plan annually against actual progress rather than trusting the projection.',
    ],
    relatedCalculators: ['sip', 'step-up-sip', 'monte-carlo', 'purchasing-power'],
    engine: 'goal-planning',
  },
  {
    id: 'retirement-corpus',
    name: 'Retirement Corpus Calculator',
    shortDescription:
      'How large a corpus you need at retirement, given current spending, inflation and the years the corpus must last.',
    category: 'planning',
    difficulty: 'intermediate',
    formulas: [
      { latex: 'C = \\text{Spend}_{retire} \\times \\sum_{t=1}^{L} \\left(\\frac{1+\\pi}{1+r_{post}}\\right)^{t}', label: 'Present value of an inflation-linked spending stream' },
    ],
    inputs: [
      inp('currentAge', 'Current age', 'number', 35, { min: 18, max: 80, unit: 'years' }),
      inp('retirementAge', 'Retirement age', 'number', 60, { min: 30, max: 85, unit: 'years' }),
      money('monthlyExpenses', 'Monthly expenses today', 80000, { min: 1 }),
      pct('inflation', 'Inflation', 6, { min: 0, max: 20 }),
      pct('preRetirementReturn', 'Return before retirement', 11, { min: -10, max: 30 }),
      pct('postRetirementReturn', 'Return after retirement', 7.5, { min: -10, max: 25 }),
      num('lifeExpectancy', 'Plan to age', 85, { min: 60, max: 105 }),
      money('existingCorpus', 'Existing retirement savings', 1500000, { min: 0 }),
    ],
    workedExample:
      'A 35-year-old spending ₹80,000 a month who retires at 60 and plans to age 85 needs a corpus of roughly ₹8 to ₹9 crore, because the expenses grow with inflation for fifty years while the corpus must fund twenty-five of them without new contributions.',
    limitations: [
      'The number produced assumes expenses grow at general inflation. Healthcare costs in retirement typically grow faster.',
      'It excludes taxes on withdrawals, which for a debt-heavy post-retirement corpus are charged at slab rates every year.',
      'Spending rarely stays flat in real terms: it typically falls in the early retirement years and rises again for healthcare.',
    ],
    relatedCalculators: ['swp', 'risk-of-ruin', 'nps-calculator', 'purchasing-power'],
    engine: 'retirement-corpus',
  },
  {
    id: 'rebalancing',
    name: 'Rebalancing Planner',
    shortDescription:
      'Current drift from target weights for four sleeves, the trades needed to restore them, and the estimated cost and tax of doing so.',
    category: 'portfolio',
    difficulty: 'intermediate',
    formulas: [
      { latex: '\\text{Drift}_i = w_i^{current} - w_i^{target}', label: 'Drift in percentage points' },
      { latex: '\\text{Trade}_i = w_i^{target} \\times V - V_i', label: 'Value to buy or sell' },
      { latex: '\\text{Cost} = \\sum |\\text{Trade}_i| \\times c', label: 'Round-trip transaction cost' },
    ],
    inputs: [
      money('value1', 'Current value: Indian equity', 3200000, { min: 0 }),
      money('value2', 'Current value: debt and deposits', 1500000, { min: 0 }),
      money('value3', 'Current value: gold', 700000, { min: 0 }),
      money('value4', 'Current value: global equity', 600000, { min: 0 }),
      pct('target1', 'Target: Indian equity', 45, { min: 0, max: 100 }),
      pct('target2', 'Target: debt and deposits', 35, { min: 0, max: 100 }),
      pct('target3', 'Target: gold', 10, { min: 0, max: 100 }),
      pct('target4', 'Target: global equity', 10, { min: 0, max: 100 }),
      pct('band', 'Tolerance band in percentage points', 5, { min: 0.5, max: 20 }),
      pct('costRate', 'Transaction cost on traded value', 0.3, { min: 0, max: 3 }),
      pct('capitalGainsTaxRate', 'Capital gains tax rate on sales', 12.5, { min: 0, max: 40 }),
    ],
    workedExample:
      'Equity that has run up to 53% of a portfolio targeting 45% breaches a 5-point band and requires selling about 8% of the portfolio. Where that sale happens inside a retirement account there is no tax cost; in a taxable account at 12.5% it may be cheaper to rebalance with new contributions for a year.',
    limitations: [
      'Rebalancing trades are estimated from the rates entered, not from your actual tax position. Harvesting losses elsewhere in the portfolio can offset gains from rebalancing.',
      'Rebalancing more often increases cost without reliably improving returns. The band, not the calendar, is the better trigger — and wider bands are cheaper than narrower ones.',
    ],
    relatedCalculators: ['portfolio-allocation', 'multi-asset', 'tax-loss-harvesting'],
    engine: 'rebalancing',
  },
  {
    id: 'inflation-adjusted-return',
    name: 'Required Return After Inflation and Tax',
    shortDescription:
      'The nominal pre-tax return an investment must produce to deliver a chosen real post-tax return — the honest target for a portfolio.',
    category: 'returns',
    difficulty: 'intermediate',
    formulas: [
      { latex: 'r_{nominal} = \\frac{(1 + r_{real})(1 + \\pi)}{1 - \\tau} - 1', label: 'Required nominal return given a real target, inflation and the tax rate', assumption: 'Assumes income is taxed annually at the marginal rate. A holding taxed only on capital gains requires a lower nominal return.' },
    ],
    inputs: [
      pct('realTarget', 'Real return you want', 4, { min: -5, max: 20 }),
      pct('inflation', 'Assumed inflation', 6, { min: 0, max: 20 }),
      pct('marginalRate', 'Your marginal tax rate', 31.2, { min: 0, max: 55 }),
      pct('availableReturn', 'Return currently available', 8, { min: -20, max: 40 }),
      yrs('years', 'Horizon', 10, { min: 1, max: 50 }),
    ],
    workedExample:
      'To earn 4% real with 6% inflation and a 31.2% marginal rate, a fully taxed investment must return about 11.05% nominal. A 7.2% fixed deposit delivers roughly 1.1% real after tax — less than a third of the target, and the gap is the reason an all-deposit portfolio cannot fund a long retirement.',
    limitations: [
      'The required return is a constraint on what you need, not a statement about what the market will provide. If the market cannot deliver it at acceptable risk, the goal has to change rather than the assumed return.',
      'Capital-gains-based investments require a lower pre-tax return than income-based ones, because the tax is deferred — a point the annual-tax assumption here understates.',
    ],
    relatedCalculators: ['real-return', 'post-tax-return', 'retirement-corpus', 'break-even-inflation'],
    engine: 'inflation-adjusted-return',
  },
];
