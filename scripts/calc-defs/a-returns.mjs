/**
 * Calculator definitions — batch A: returns and the measurement of performance.
 *
 * Each definition drives the calculator UI. The arithmetic lives in
 * src/lib/calculators/compute.ts, keyed by the same id.
 */

const inp = (id, label, kind, def, extra = {}) => ({ id, label, kind, default: def, ...extra });
const money = (id, label, def, extra = {}) => inp(id, label, 'currency', def, { unit: '₹', min: 0, ...extra });
const pct = (id, label, def, extra = {}) => inp(id, label, 'percent', def, { unit: '%', ...extra });
const yrs = (id, label, def, extra = {}) => inp(id, label, 'years', def, { unit: 'years', min: 0, ...extra });
const num = (id, label, def, extra = {}) => inp(id, label, 'number', def, extra);

export default [
  {
    id: 'cagr',
    name: 'CAGR Calculator',
    shortDescription:
      'Compound annual growth rate between two values over a stated period — the only form of a return that is comparable across different horizons.',
    category: 'returns',
    difficulty: 'foundational',
    formulas: [
      {
        latex: 'CAGR = \\left(\\frac{V_T}{V_0}\\right)^{1/T} - 1',
        label: 'Compound annual growth rate',
        assumption: 'Requires a positive beginning value and a positive ending value; a total loss has no finite CAGR.',
      },
    ],
    inputs: [
      money('beginValue', 'Value at the start', 100000, { min: 1 }),
      money('endValue', 'Value at the end', 250000),
      yrs('years', 'Holding period', 5, { min: 0.08, max: 60 }),
    ],
    workedExample:
      '₹1,00,000 growing to ₹2,50,000 over five years is a CAGR of 20.11%. The cumulative return is 150% — the same facts, and a very different impression.',
    limitations: [
      'A CAGR is a smoothed average. The actual path may have included a 40% drawdown in the middle, which the single figure conceals entirely.',
      'It assumes a single beginning value, so it cannot describe an investment built up through periodic contributions — use XIRR for that.',
    ],
    relatedCalculators: ['xirr', 'sip', 'rolling-returns'],
    engine: 'cagr',
  },
  {
    id: 'xirr',
    name: 'XIRR Calculator',
    shortDescription:
      'The money-weighted annualised return on a set of dated cash flows — the correct return figure for an investment made in instalments.',
    category: 'returns',
    difficulty: 'intermediate',
    formulas: [
      { latex: '\\sum_{i=0}^{n} \\frac{CF_i}{(1+r)^{(d_i - d_0)/365}} = 0', label: 'XIRR solves for r', assumption: 'Cash flows must be dated and must include at least one negative (contribution) and one positive (receipt).' },
    ],
    inputs: [
      num('amount1', 'Cash flow 1 (negative = you paid out)', -100000, { unit: '₹' }),
      inp('date1', 'Date of cash flow 1', 'date', '2021-04-01'),
      num('amount2', 'Cash flow 2', -100000, { unit: '₹' }),
      inp('date2', 'Date of cash flow 2', 'date', '2022-04-01'),
      num('amount3', 'Cash flow 3', 150000, { unit: '₹' }),
      inp('date3', 'Date of cash flow 3', 'date', '2024-04-01'),
      num('amount4', 'Cash flow 4 (final value or 0)', 120000, { unit: '₹' }),
      inp('date4', 'Date of cash flow 4', 'date', '2026-04-01', { help: 'Enter the current or terminal value as the last positive flow.' }),
    ],
    workedExample:
      'Two ₹1,00,000 contributions a year apart, followed by a ₹1,50,000 receipt and a ₹1,20,000 terminal value, produces an XIRR that differs from the simple CAGR of the same amounts — because the money was not invested for the whole period.',
    limitations: [
      'If the cash-flow pattern changes sign more than once, more than one rate can satisfy the equation. The calculator reports this rather than hiding it.',
      'XIRR is a per-annum rate and becomes misleading over horizons shorter than about a year, where it can imply absurd annualised figures.',
    ],
    relatedCalculators: ['cagr', 'sip', 'p2p-return'],
    engine: 'xirr',
  },
  {
    id: 'sip',
    name: 'SIP Calculator',
    shortDescription:
      'Future value of a monthly systematic investment plan at a stated rate, showing the split between money invested and money earned.',
    category: 'returns',
    difficulty: 'foundational',
    formulas: [
      {
        latex: 'FV = P \\times \\frac{(1+i)^n - 1}{i} \\times (1+i)',
        label: 'SIP future value, contribution at the start of each month',
        assumption: 'A constant rate of return with no volatility. Real SIP returns arrive unevenly, and the order matters.',
      },
    ],
    inputs: [
      money('monthly', 'Monthly investment', 10000, { min: 1 }),
      pct('rate', 'Assumed annual return', 12, { min: -50, max: 60 }),
      yrs('years', 'Investment period', 10, { min: 0.25, max: 50 }),
      inp('timing', 'Contribution timing', 'select', 'begin', {
        options: [
          { value: 'begin', label: 'Start of each month' },
          { value: 'end', label: 'End of each month' },
        ],
      }),
    ],
    workedExample:
      '₹10,000 a month for ten years at 12% a year accumulates about ₹23.2 lakh, of which ₹12 lakh is your own money. The ₹11.2 lakh difference is the assumption, not a promise.',
    limitations: [
      'The rate is an assumption supplied by you. Changing it from 12% to 9% removes roughly a quarter of the final corpus.',
      'Taxes and exit loads are not deducted. For an equity fund held over ten years, the tax on the terminal gain can be 12.5% of a large number.',
      'A constant return understates the probability of undershooting a goal, because real sequences include long flat and falling stretches.',
    ],
    relatedCalculators: ['step-up-sip', 'xirr', 'monte-carlo', 'post-tax-return'],
    engine: 'sip',
  },
  {
    id: 'step-up-sip',
    name: 'Step-Up SIP Calculator',
    shortDescription:
      'SIP with an annual increase in the instalment, which is how most salaried investors actually behave as income rises.',
    category: 'returns',
    difficulty: 'intermediate',
    formulas: [
      { latex: 'P_{y+1} = P_y \\times (1 + s)', label: 'Instalment steps up by s each year', assumption: 'The step-up is applied once a year, on the anniversary of the first instalment.' },
    ],
    inputs: [
      money('monthly', 'Starting monthly investment', 10000, { min: 1 }),
      pct('stepUp', 'Annual step-up', 10, { min: 0, max: 50 }),
      pct('rate', 'Assumed annual return', 12, { min: -50, max: 60 }),
      yrs('years', 'Investment period', 15, { min: 0.25, max: 50 }),
    ],
    workedExample:
      'A ₹10,000 instalment rising 10% a year for fifteen years, at 12%, invests about ₹38 lakh in total and ends near ₹1.2 crore — a much larger outcome than a flat SIP, but only because a great deal more money was contributed.',
    limitations: [
      'The comparison with a flat SIP is not like-for-like. Compare the internal rate of return instead of the final corpus.',
      'Stepping up assumes income rises every year. A career interruption breaks the assumption and the projection with it.',
    ],
    relatedCalculators: ['sip', 'goal-planning', 'monte-carlo'],
    engine: 'step-up-sip',
  },
  {
    id: 'lumpsum',
    name: 'Lump Sum Calculator',
    shortDescription: 'Future value of a single investment at a compounded rate, with the multiple and the gain shown separately.',
    category: 'returns',
    difficulty: 'foundational',
    formulas: [
      { latex: 'FV = PV \\left(1 + \\frac{r}{m}\\right)^{mT}', label: 'Future value with m compounding periods a year' },
      { latex: '\\text{Rule of 72: } T_{double} \\approx \\frac{72}{100r}', label: 'Doubling time, an approximation', assumption: 'Accurate to within a few percent for rates between about 4% and 15%.' },
    ],
    inputs: [
      money('principal', 'Amount invested', 500000, { min: 1 }),
      pct('rate', 'Assumed annual return', 10, { min: -50, max: 60 }),
      yrs('years', 'Investment period', 20, { min: 0.08, max: 60 }),
      inp('frequency', 'Compounding', 'select', '1', {
        options: [
          { value: '1', label: 'Annual (1)' },
          { value: '2', label: 'Half-yearly (2)' },
          { value: '4', label: 'Quarterly (4)' },
          { value: '12', label: 'Monthly (12)' },
        ],
      }),
    ],
    workedExample:
      '₹5,00,000 at 10% for twenty years becomes about ₹33.6 lakh with annual compounding. The same nominal rate compounded monthly produces a visibly higher figure — the difference is the effective annual rate, not extra return.',
    limitations: [
      'Compounding frequency is a convention, not a benefit. Compare effective annual rates, never nominal rates with different frequencies.',
      'At 10%, money doubles roughly every 7.2 years. At 15%, every 4.8 years. Doubling times are highly sensitive to the rate you assume.',
    ],
    relatedCalculators: ['cagr', 'real-return', 'expense-ratio-impact'],
    engine: 'lumpsum',
  },
  {
    id: 'swp',
    name: 'SWP Calculator',
    shortDescription:
      'Systematic withdrawal plan: how long a corpus lasts at a given withdrawal rate and return, and what the terminal balance looks like.',
    category: 'planning',
    difficulty: 'intermediate',
    formulas: [
      { latex: 'B_t = (B_{t-1} - W_t)(1 + r)', label: 'Annual withdrawal then growth', assumption: 'Withdrawals are taken at the start of the year, which is the conservative ordering.' },
    ],
    inputs: [
      money('corpus', 'Starting corpus', 5000000, { min: 1 }),
      pct('withdrawalRate', 'Annual withdrawal rate', 6, { min: 0.5, max: 30 }),
      pct('returnRate', 'Assumed annual return', 9, { min: -20, max: 30 }),
      yrs('years', 'Years to project', 30, { min: 1, max: 60 }),
      pct('escalation', 'Annual increase in withdrawal', 5, { min: 0, max: 15 }, ),
    ],
    workedExample:
      '₹50,00,000 with a 6% initial withdrawal (₹3,00,000 a year, rising 5% annually) and a 9% return lasts beyond thirty years in this model. At a 9% withdrawal rate with the same return, the corpus runs dry in the late teens.',
    limitations: [
      'A constant return makes any withdrawal plan look safe. The dominant real-world risk is a poor sequence of returns in the first years of withdrawal.',
      'Taxes on withdrawals are excluded, and for a debt-heavy corpus they are charged at slab rates every year.',
    ],
    relatedCalculators: ['sequence-risk', 'annuity-vs-swp', 'retirement-corpus'],
    engine: 'swp',
  },
  {
    id: 'real-return',
    name: 'Real Return Calculator',
    shortDescription:
      'The inflation-adjusted return — what actually happened to your purchasing power, as distinct from what your account statement says.',
    category: 'returns',
    difficulty: 'foundational',
    formulas: [
      { latex: 'r_{real} = \\frac{1 + r_{nominal}}{1 + \\pi} - 1', label: 'Exact real return' },
      { latex: 'r_{real} \\approx r_{nominal} - \\pi', label: 'The approximation most people use', assumption: 'Drifts materially from the exact figure as rates or inflation rise; at 12% nominal and 6% inflation the error is about 0.34 percentage points a year.' },
    ],
    inputs: [
      pct('nominal', 'Nominal return', 12, { min: -50, max: 60 }),
      pct('inflation', 'Inflation rate', 6, { min: -10, max: 30 }),
      yrs('years', 'Holding period', 10, { min: 0.5, max: 60 }),
    ],
    workedExample:
      'At 12% nominal and 6% inflation, the exact real return is 5.66% a year. Over ten years that is a 73% gain in purchasing power — not the 79% the approximation suggests.',
    limitations: [
      'The inflation figure you use is a national average. Your personal inflation depends on your consumption basket and is often much higher for education, healthcare and rent.',
      'Taxes are ignored here. A fixed deposit at 7% with 6% inflation and a 30% slab rate has a negative real return.',
    ],
    relatedCalculators: ['nominal-vs-real', 'post-tax-return', 'purchasing-power'],
    engine: 'real-return',
  },
  {
    id: 'nominal-vs-real',
    name: 'Nominal vs Real Wealth',
    shortDescription:
      'Shows the growing gap between the rupee value of a corpus and what that corpus can buy, year by year.',
    category: 'returns',
    difficulty: 'foundational',
    formulas: [
      { latex: '\\text{Real value}_T = \\frac{V_T (1+r)^T}{(1+\\pi)^T}', label: 'Purchasing power of the terminal corpus' },
    ],
    inputs: [
      money('amount', 'Amount today', 1000000, { min: 1 }),
      pct('nominal', 'Assumed nominal return', 8, { min: -20, max: 40 }),
      pct('inflation', 'Assumed inflation', 6, { min: 0, max: 30 }),
      yrs('years', 'Horizon', 20, { min: 1, max: 60 }),
    ],
    workedExample:
      '₹10,00,000 at 8% for twenty years becomes ₹46.6 lakh. At 6% inflation, that ₹46.6 lakh buys what ₹14.5 lakh buys today — a real gain, but nothing like the nominal figure implies.',
    limitations: [
      'Nominal wealth is the number printed in your statement; real wealth is what you can spend. Goals stated in today’s prices need the real figure, not the nominal one.',
    ],
    relatedCalculators: ['real-return', 'purchasing-power', 'goal-planning'],
    engine: 'nominal-vs-real',
  },
  {
    id: 'post-tax-return',
    name: 'Post-Tax Return Calculator',
    shortDescription:
      'The after-tax outcome for a given asset type and holding period, distinguishing tax charged every year from tax charged once at the end.',
    category: 'tax',
    difficulty: 'advanced',
    formulas: [
      { latex: 'V_T^{post} = 1 + (V_T - 1)(1 - \\tau_{terminal})', label: 'Terminal capital-gains tax' },
      { latex: 'V_T^{post} = \\left[1 + r(1 - \\tau_{annual})\\right]^{T}', label: 'Annual tax on income', assumption: 'The tax paid each year is capital you no longer have, so it compounds against you.' },
    ],
    inputs: [
      inp('taxClass', 'Asset and income type', 'select', 'equity-listed', {
        options: [
          { value: 'equity-listed', label: 'Listed equity / equity mutual fund' },
          { value: 'equity-unlisted', label: 'Unlisted shares / pre-IPO' },
          { value: 'debt-specified-mf', label: 'Specified debt mutual fund (post 1 April 2023)' },
          { value: 'interest-income', label: 'Bank or corporate deposit interest' },
          { value: 'dividend', label: 'Dividend' },
          { value: 'gold-etf', label: 'Gold ETF or gold fund' },
          { value: 'property-long-term', label: 'Property (long-term)' },
          { value: 'vda', label: 'Virtual digital assets' },
          { value: 'ppf-exempt', label: 'PPF or other exempt-exempt-exempt' },
          { value: 'sgb-redemption', label: 'Sovereign gold bond' },
          { value: 'reit-invit-unit', label: 'REIT or InvIT units' },
        ],
      }),
      pct('grossReturn', 'Assumed gross annual return', 12, { min: -40, max: 60 }),
      yrs('holdingYears', 'Holding period', 10, { min: 0.08, max: 50 }),
      pct('marginalSlabRate', 'Your marginal slab rate', 30, { min: 0, max: 45 }),
      money('totalIncome', 'Total annual income (for surcharge)', 2000000, { help: 'Surcharge begins above ₹50 lakh of total income and is capped at 15% for capital gains and dividend.' }),
    ],
    workedExample:
      'The same 12% a year, held ten years: listed equity is taxed once at 12.5% (plus cess) on the gain, while deposit interest at a 30% slab rate is taxed every year. The difference in the final post-tax corpus is larger than the difference in the headline rates suggests.',
    limitations: [
      'This is a planning estimate, not a return computation. Cost inflation indexation, set-off of brought-forward losses and the property indexation option for pre-July-2024 acquisitions are not modelled here in full.',
      'Rules change. Every figure carries the financial year it applies to.',
    ],
    relatedCalculators: ['taxable-equivalent-yield', 'tax-loss-harvesting', 'deposit-comparison'],
    engine: 'post-tax-return',
  },
  {
    id: 'taxable-equivalent-yield',
    name: 'Taxable Equivalent Yield',
    shortDescription:
      'The pre-tax return a taxable investment would need in order to match a tax-free one, at your marginal rate.',
    category: 'tax',
    difficulty: 'intermediate',
    formulas: [
      { latex: 'r_{taxable} = \\frac{r_{tax\\ free}}{1 - \\tau}', label: 'Taxable-equivalent yield', assumption: 'Compares income taxed annually; not appropriate for comparing a tax-free instrument with one taxed only on capital gains.' },
    ],
    inputs: [
      pct('taxFreeYield', 'Tax-free or exempt return', 7.1, { min: 0, max: 30 }),
      pct('marginalRate', 'Your marginal tax rate including surcharge and cess', 31.2, { min: 0, max: 50 }),
    ],
    workedExample:
      'A PPF rate of 7.1%, for an investor on a 31.2% all-in marginal rate, is worth as much as a taxable instrument at 10.32%. An investor on a 0% marginal rate gains nothing from the exemption at all.',
    limitations: [
      'The exemption’s value depends entirely on the slab rate, so it is worth most to high earners — a distributional fact worth noticing when such products are marketed as universally advantageous.',
      'Lock-in and contribution limits are not captured. PPF’s annual contribution ceiling means the tax advantage cannot be scaled.',
    ],
    relatedCalculators: ['post-tax-return', 'ppf-calculator', 'deposit-comparison'],
    engine: 'taxable-equivalent-yield',
  },
  {
    id: 'expense-ratio-impact',
    name: 'Expense Ratio Impact',
    shortDescription:
      'What a fund’s annual expense ratio costs over a holding period, expressed both in rupees and as a share of the final corpus.',
    category: 'returns',
    difficulty: 'foundational',
    formulas: [
      { latex: 'V_T = P(1 + r - e)^T', label: 'Growth net of an annual expense ratio e' },
      { latex: '\\text{Cost} = P(1+r)^T - P(1+r-e)^T', label: 'The rupee cost of the fee' },
    ],
    inputs: [
      money('amount', 'Amount invested', 1000000, { min: 1 }),
      pct('grossReturn', 'Gross return before expenses', 12, { min: -20, max: 40 }),
      pct('expenseRatio', 'Expense ratio', 1.8, { min: 0, max: 4 }),
      yrs('years', 'Holding period', 25, { min: 1, max: 50 }),
      pct('directExpenseRatio', 'Comparison expense ratio (e.g. direct plan)', 0.6, { min: 0, max: 4 }),
    ],
    workedExample:
      'On ₹10,00,000 at 12% gross, an expense ratio of 1.8% instead of 0.6% leaves roughly ₹5.6 lakh less after twenty-five years. The fee is charged once a year on a balance that grows, which is why the cumulative figure is not the annual figure multiplied by the number of years.',
    limitations: [
      'Expense ratios vary over time and are not the only cost. Brokerage, impact cost and the fund’s own transaction costs sit outside the published ratio.',
      'A cheaper fund is not automatically the better fund, but the fee is the one return component that is known in advance.',
    ],
    relatedCalculators: ['tracking-error', 'lumpsum', 'post-tax-return'],
    engine: 'expense-ratio-impact',
  },
  {
    id: 'tracking-error',
    name: 'Tracking Difference Calculator',
    shortDescription:
      'Decomposes the gap between an index fund’s return and its benchmark into the expense ratio and the residual tracking error.',
    category: 'returns',
    difficulty: 'intermediate',
    formulas: [
      { latex: '\\text{Tracking difference} = r_{fund} - r_{index}', label: 'Realised gap over a period' },
      { latex: '\\text{Tracking error} = \\sigma(r_{fund} - r_{index})', label: 'Volatility of the gap', assumption: 'Both figures need a stated measurement frequency — daily and monthly tracking error differ by roughly the square root of time.' },
    ],
    inputs: [
      pct('fundReturn', 'Fund return over the period', 12.4, { min: -50, max: 80 }),
      pct('indexReturn', 'Index (TRI) return over the period', 12.9, { min: -50, max: 80 }),
      pct('expenseRatio', 'Fund expense ratio', 0.2, { min: 0, max: 3 }),
      num('trackingErrorDaily', 'Daily tracking error (if known)', 0.06, { min: 0, max: 5, help: 'Leave as reported by the fund; the annualised figure is this value multiplied by the square root of 252.' }),
    ],
    workedExample:
      'A fund returning 12.4% against an index at 12.9% has a tracking difference of −0.5 percentage points. If the expense ratio is 0.2%, then 0.3 points came from something else: cash drag, transaction costs or sampling.',
    limitations: [
      'Tracking difference and tracking error are different numbers and are routinely confused. A fund can have a small error and a large difference.',
      'Compare total-return index values, not price indices. An index without dividends cannot be tracked by a fund that receives them.',
    ],
    relatedCalculators: ['expense-ratio-impact', 'cagr'],
    engine: 'tracking-error',
  },
  {
    id: 'opportunity-cost',
    name: 'Opportunity Cost Calculator',
    shortDescription:
      'What money left idle in cash would have become if invested — the invisible cost of holding too much liquidity.',
    category: 'planning',
    difficulty: 'foundational',
    formulas: [
      { latex: '\\text{Foregone} = C(1+r)^T - C', label: 'Value forgone by holding cash', assumption: 'Compares a certain alternative return with the actual holding; the alternative might not have materialised.' },
    ],
    inputs: [
      money('amount', 'Amount held idle', 500000, { min: 1 }),
      pct('alternativeReturn', 'Return on the alternative investment', 11, { min: -30, max: 50 }),
      yrs('years', 'Period', 5, { min: 0.08, max: 40 }),
    ],
    workedExample:
      '₹5,00,000 left in a savings account for five years instead of an investment returning 11% forgoes about ₹3.4 lakh of value. The savings account did pay interest; the calculation nets it off only if you enter the difference as the return.',
    limitations: [
      'The alternative is hypothetical and would have carried risk. The calculation is a discipline for thinking about idle cash, not evidence that the alternative was certain.',
      'Emergency liquidity has genuine value that this calculator cannot price. The relevant question is how much cash is enough, not whether any is.',
    ],
    relatedCalculators: ['emergency-fund', 'real-return', 'lumpsum'],
    engine: 'opportunity-cost',
  },
  {
    id: 'break-even-inflation',
    name: 'Break-Even Inflation',
    shortDescription:
      'The inflation rate that exactly erases a given nominal return, and the nominal return needed to beat inflation by a chosen margin.',
    category: 'returns',
    difficulty: 'foundational',
    formulas: [
      { latex: '\\pi_{break\\ even} = r_{nominal}', label: 'Inflation at which the real return is exactly zero' },
      { latex: 'r_{required} = (1 + r_{real\\ target})(1 + \\pi) - 1', label: 'Nominal return required for a real target' },
    ],
    inputs: [
      pct('nominal', 'Nominal return available', 7, { min: -20, max: 40 }),
      pct('inflation', 'Assumed inflation', 6, { min: 0, max: 30 }),
      pct('realTarget', 'Real return you want', 3, { min: -10, max: 20 }),
    ],
    workedExample:
      'A 7% deposit breaks even at 7% inflation — not at 0% inflation, which is how the 7% minus 7% = 0% approximation is sometimes misread. To earn a 3% real return with inflation at 6%, the nominal return must be 9.18%.',
    limitations: [
      'Taxes are ignored. For a taxpayer on a 31.2% all-in marginal rate, a 7% deposit nets 4.82% and therefore requires inflation below that to preserve purchasing power.',
    ],
    relatedCalculators: ['real-return', 'deposit-comparison', 'post-tax-return'],
    engine: 'break-even-inflation',
  },
  {
    id: 'purchasing-power',
    name: 'Purchasing Power Calculator',
    shortDescription:
      'What a future sum will actually be worth, and how much you need in the future to afford something that costs a known amount today.',
    category: 'planning',
    difficulty: 'foundational',
    formulas: [
      { latex: '\\text{Cost}_T = C_0 (1+\\pi)^T', label: 'Future cost of today’s expense' },
      { latex: '\\text{Real value}_T = \\frac{V}{(1+\\pi)^T}', label: 'Today’s-money value of a future sum' },
    ],
    inputs: [
      money('amount', 'Amount today', 2000000, { min: 1 }),
      pct('inflation', 'Assumed inflation', 6, { min: 0, max: 30 }),
      yrs('years', 'Years ahead', 20, { min: 1, max: 60 }),
    ],
    workedExample:
      'An education that costs ₹20,00,000 today, inflating at 8% a year, costs about ₹93 lakh in twenty years. Planning for ₹20 lakh is planning for less than a quarter of the bill.',
    limitations: [
      'Education, healthcare and rent inflate faster than the general index in India. Use a category-specific rate where one is available rather than the headline consumer price inflation.',
    ],
    relatedCalculators: ['nominal-vs-real', 'goal-planning', 'real-return'],
    engine: 'purchasing-power',
  },
  {
    id: 'dividend-return',
    name: 'Total Return Decomposition',
    shortDescription:
      'Splits an equity holding’s return into price appreciation and dividends, with dividends reinvested, and shows the tax on each.',
    category: 'returns',
    difficulty: 'intermediate',
    formulas: [
      { latex: '\\text{Total return} = \\frac{P_T + \\sum D_t (1+r)^{T-t}}{P_0} - 1', label: 'With dividends reinvested at rate r', assumption: 'Reinvestment is assumed to be available at the stated rate, which is generous.' },
    ],
    inputs: [
      money('initialPrice', 'Purchase price per share', 500, { min: 1 }),
      money('finalPrice', 'Price at the end', 1200, { min: 0 }),
      pct('dividendYield', 'Initial dividend yield', 1.5, { min: 0, max: 15 }),
      pct('dividendGrowth', 'Annual dividend growth', 8, { min: -20, max: 40 }),
      yrs('years', 'Holding period', 10, { min: 0.5, max: 40 }),
    ],
    workedExample:
      'A share bought at ₹500 and sold at ₹1,200 ten years later returned 9.15% a year on price alone. Adding dividends that started at 1.5% and grew 8% a year raises the total to roughly 11%.',
    limitations: [
      'Dividend reinvestment is taxed in the year received, so the post-tax compounding rate is below the gross rate used here.',
      'Dividend yield is not a return. A company paying out 6% and growing earnings at 2% is not the same asset as one paying 2% and growing at 8%, even if the total return matched historically.',
    ],
    relatedCalculators: ['cagr', 'post-tax-return', 'reit-distribution'],
    engine: 'dividend-return',
  },
];
