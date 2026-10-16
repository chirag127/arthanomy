/**
 * Calculator definitions — batch E: derivatives, futures and option strategies.
 */

const inp = (id, label, kind, def, extra = {}) => ({ id, label, kind, default: def, ...extra });
const money = (id, label, def, extra = {}) => inp(id, label, 'currency', def, { unit: '₹', min: 0, ...extra });
const pct = (id, label, def, extra = {}) => inp(id, label, 'percent', def, { unit: '%', ...extra });
const num = (id, label, def, extra = {}) => inp(id, label, 'number', def, extra);
const TYPE = {
  id: 'optionType',
  label: 'Option type',
  kind: 'select',
  default: 'call',
  options: [
    { value: 'call', label: 'Call' },
    { value: 'put', label: 'Put' },
  ],
};
const TYPE_OPTIONS = TYPE.options;
const DIRECTION_OPTIONS = [
  { value: 'long', label: 'Long' },
  { value: 'short', label: 'Short' },
];

export default [
  {
    id: 'option-payoff',
    name: 'Option Payoff Calculator',
    shortDescription:
      'The payoff and profit of a single option position at expiry, with the break-even and the maximum loss stated plainly.',
    category: 'derivatives',
    difficulty: 'intermediate',
    formulas: [
      { latex: '\\text{Call payoff} = \\max(S_T - K, 0), \\quad \\text{Put payoff} = \\max(K - S_T, 0)', label: 'Intrinsic value at expiry' },
      { latex: '\\text{Profit} = \\text{Payoff} - \\text{Premium}', label: 'For a long position', assumption: 'Ignores transaction costs, STT and the bid-ask spread, all of which are material for short-dated options.' },
    ],
    inputs: [
      inp('optionType', 'Option type', 'select', 'call', { options: TYPE_OPTIONS }),
      inp('direction', 'Position', 'select', 'long', { options: DIRECTION_OPTIONS }),
      money('spot', 'Underlying price today', 25000, { min: 1 }),
      money('strike', 'Strike price', 25500, { min: 1 }),
      money('premium', 'Premium paid or received per unit', 180, { min: 0 }),
      num('quantity', 'Number of units (lot × lots)', 75, { min: 1 }),
      num('movePercent', 'Move in the underlying at expiry', -5, { min: -50, max: 50, help: 'Used to compute the outcome at expiry for a chosen price path.' }),
    ],
    workedExample:
      'Buying a 25,500 call for ₹180 on a 25,000 index breaks even at 25,680 at expiry. A 5% fall to 23,750 produces a total loss of the ₹13,500 premium (75 units × ₹180) — the loss is complete even though the index fell only 5%.',
    limitations: [
      'Payoff at expiry is only one point in the life of the position. Before expiry, the option has time value that decays, and the path matters.',
      'Costs are excluded. On short-dated index options, the spread and statutory charges are a large fraction of a small premium.',
      'Buying options is a negative-expectation bet in most Indian retail configurations: the premium paid consistently exceeds the realised value of the option.',
    ],
    relatedCalculators: ['option-strategy-builder', 'black-scholes', 'greeks', 'margin-requirement'],
    engine: 'option-payoff',  },
  {
    id: 'option-strategy-builder',
    name: 'Option Strategy Builder',
    shortDescription:
      'Builds a two-leg option structure, computes the payoff diagram, both break-evens and the maximum gain and loss.',
    category: 'derivatives',
    difficulty: 'expert',
    formulas: [
      { latex: '\\text{Profit} = \\sum_i s_i \\left(\\max(\\pm(S_T - K_i), 0) - P_i\\right)', label: 'Net payoff of a multi-leg position' },
    ],
    inputs: [
      inp('leg1Type', 'Leg 1 type', 'select', 'call', { options: TYPE_OPTIONS }),
      inp('leg1Direction', 'Leg 1 direction', 'select', 'short', { options: DIRECTION_OPTIONS }),
      money('leg1Strike', 'Leg 1 strike', 25500, { min: 1 }),
      money('leg1Premium', 'Leg 1 premium', 180, { min: 0 }),
      inp('leg2Type', 'Leg 2 type', 'select', 'call', { options: TYPE_OPTIONS }),
      inp('leg2Direction', 'Leg 2 direction', 'select', 'long', { options: DIRECTION_OPTIONS }),
      money('leg2Strike', 'Leg 2 strike', 26000, { min: 1 }),
      money('leg2Premium', 'Leg 2 premium', 95, { min: 0 }),
      num('quantity', 'Lots × lot size', 75, { min: 1 }),
      money('spot', 'Current underlying price', 25000, { min: 1 }),
    ],
    workedExample:
      'Selling the 25,500 call for ₹180 and buying the 26,000 call for ₹95 collects ₹85 net. Maximum gain is ₹6,375 if the index finishes at or below 25,500; maximum loss is ₹31,125 above 26,000; the upper break-even is 25,585. The structure profits most of the time and loses heavily in the tail — which is precisely why it is sold.',
    limitations: [
      'Two legs mean two spreads, twice the statutory charges and a margin requirement on the short leg that can change intraday.',
      'Maximum loss assumes the position is held to expiry. An adverse move before expiry can trigger a margin call that forces an exit at a worse price than the expiry payoff implies.',
      'A high probability of a small gain is not the same as a low-risk position. The expected loss conditional on a loss is many times the expected gain.',
    ],
    relatedCalculators: ['option-payoff', 'greeks', 'margin-requirement', 'risk-of-ruin'],    engine: 'option-strategy-builder',
  },
  {
    id: 'black-scholes',
    name: 'Black-Scholes Option Price',
    shortDescription:
      'Theoretical European option value with d1, d2, intrinsic value and time value, and the model’s assumptions stated with the result.',
    category: 'derivatives',
    difficulty: 'expert',
    formulas: [
      { latex: 'C = S e^{-qT} N(d_1) - K e^{-rT} N(d_2)', label: 'Call value' },
      { latex: 'P = K e^{-rT} N(-d_2) - S e^{-qT} N(-d_1)', label: 'Put value' },
      { latex: 'd_1 = \\frac{\\ln(S/K) + (r - q + \\sigma^2/2)T}{\\sigma\\sqrt{T}}', label: 'd1' },
    ],
    inputs: [
      money('spot', 'Spot price of the underlying', 25000, { min: 1 }),
      money('strike', 'Strike price', 25500, { min: 1 }),
      num('days', 'Days to expiry', 30, { min: 1, max: 1095 }),
      pct('riskFreeRate', 'Risk-free rate', 6.5, { min: 0, max: 20 }),
      pct('volatility', 'Volatility', 18, { min: 0.5, max: 200 }),
      pct('dividendYield', 'Dividend or carry yield', 1.2, { min: 0, max: 15 }),
      TYPE,
    ],
    workedExample:
      'A 30-day option on a 25,000 index with a 25,500 strike, 18% volatility and a 6.5% rate is worth roughly ₹180, of which the entire amount is time value because the option is out of the money. With five days to expiry the same option is worth a small fraction of that.',
    limitations: [
      'The model assumes constant volatility and continuous costless hedging. Indian option prices display a pronounced volatility smile, so a single input volatility cannot reproduce the market.',
      'Indian index options are European and cash-settled, which suits the model; stock options are physically settled with American-style exercise, which the model does not handle. Use the binomial method for those.',
      'The output is a price under assumptions, not a prediction of where the option will trade.',
    ],
    relatedCalculators: ['implied-volatility', 'greeks', 'option-payoff'],
    engine: 'black-scholes',
  },
  {
    id: 'implied-volatility',
    name: 'Implied Volatility',
    shortDescription: 'The volatility that, fed into the model, exactly reproduces an observed market price.',
    category: 'derivatives',
    difficulty: 'expert',
    formulas: [
      { latex: '\\text{Solve } BS(S, K, T, r, \\sigma) = \\text{Market price for } \\sigma', label: 'Implied volatility by bisection' },
    ],
    inputs: [
      money('marketPrice', 'Observed option price', 180, { min: 0.01 }),
      money('spot', 'Spot price', 25000, { min: 1 }),
      money('strike', 'Strike price', 25500, { min: 1 }),
      num('days', 'Days to expiry', 30, { min: 1, max: 1095 }),
      pct('riskFreeRate', 'Risk-free rate', 6.5, { min: 0, max: 20 }),
      TYPE,
    ],
    workedExample:
      'A ₹180 premium on a 30-day 25,500 call with the index at 25,000 implies roughly 19% volatility. Ten points away on the same expiry, the implied volatility is typically several points different — that spread is the smile, and it is not an inefficiency as much as a market view about tail risk.',
    limitations: [
      'Implied volatility is an output of a model, not a directly observable quantity. Change the model and the implied number changes.',
      'A price below intrinsic value has no solution; the calculator says so rather than returning a number. This usually signals a stale quote or a data error.',
      'Deep out-of-the-money options have very low vega, so a small price error translates into a large implied-volatility error. Compare implied volatilities only across strikes with meaningful premium.',
    ],
    relatedCalculators: ['black-scholes', 'greeks', 'option-strategy-builder'],
    engine: 'implied-volatility',
  },
  {
    id: 'greeks',
    name: 'Option Greeks',
    shortDescription:
      'Delta, gamma, theta, vega and rho for a single option, expressed per one percentage point where that is the useful unit.',
    category: 'derivatives',
    difficulty: 'expert',
    formulas: [
      { latex: '\\Delta_c = N(d_1), \\quad \\Gamma = \\frac{\\phi(d_1)}{S\\sigma\\sqrt{T}}', label: 'Delta and gamma' },
      { latex: '\\Theta = -\\frac{S\\phi(d_1)\\sigma}{2\\sqrt{T}} - rKe^{-rT}N(d_2)', label: 'Theta: value lost per unit of time' },
      { latex: '\\nu = S\\phi(d_1)\\sqrt{T}', label: 'Vega per unit of volatility' },
    ],
    inputs: [
      money('spot', 'Spot price', 25000, { min: 1 }),
      money('strike', 'Strike price', 25500, { min: 1 }),
      num('days', 'Days to expiry', 30, { min: 1, max: 1095 }),
      pct('riskFreeRate', 'Risk-free rate', 6.5, { min: 0, max: 20 }),
      pct('volatility', 'Volatility', 18, { min: 0.5, max: 200 }),
      pct('dividendYield', 'Dividend or carry yield', 1.2, { min: 0, max: 15 }),
      TYPE,
    ],
    workedExample:
      'This 30-day out-of-the-money call has a delta near 0.38, so it gains about ₹9.5 for every ₹25 move in the index. It loses roughly ₹5 a day to time decay, which rises sharply in the final week — the reason an out-of-the-money option can be correct on direction and still lose money.',
    limitations: [
      'Greeks are local derivatives. They describe what happens for an infinitesimal change, and they change as the underlying moves. Gamma is the rate at which delta itself changes.',
      'Theta assumes implied volatility is unchanged, which is rarely true. A fall in implied volatility can cost more than the time decay gains.',
      'The numbers here come from the Black-Scholes model and inherit its assumptions, including a constant volatility surface.',
    ],
    relatedCalculators: ['black-scholes', 'implied-volatility', 'option-strategy-builder'],
    engine: 'greeks',
  },
  {
    id: 'margin-requirement',
    name: 'Futures Margin and Liquidation',
    shortDescription:
      'How a margin requirement translates into leverage, and the adverse move that consumes the posted margin.',
    category: 'derivatives',
    difficulty: 'intermediate',
    formulas: [
      { latex: '\\text{Leverage} = \\frac{1}{\\text{margin rate}}', label: 'Implied leverage' },
      { latex: '\\text{Loss} = \\text{Notional} \\times \\Delta\\%', label: 'Loss on an adverse move' },
    ],
    inputs: [
      money('notional', 'Notional exposure', 5000000, { min: 1 }),
      pct('marginRate', 'Margin requirement', 12, { min: 1, max: 100 }),
      pct('adverseMove', 'Adverse move in the underlying', 5, { min: 0, max: 40 }),
      pct('maintenanceMargin', 'Maintenance margin requirement', 10, { min: 0.5, max: 100 }),
    ],
    workedExample:
      'A 12% margin on ₹50,00,000 of notional exposure requires ₹6,00,000 and implies leverage of about 8.3 times. A 5% adverse move loses ₹2,50,000 — over 40% of the posted margin. A 12% move eliminates it entirely and triggers a demand for more money at the worst possible moment.',
    limitations: [
      'Exchange margin requirements are computed from volatility and can rise sharply with no notice. The margin posted today may be insufficient next week on an unchanged position.',
      'Losses are realised by the exchange or broker acting on the position, not by the investor choosing the moment. Forced exit at the low is the standard mechanism by which leverage converts a temporary drawdown into a permanent loss.',
    ],
    relatedCalculators: ['max-drawdown', 'risk-of-ruin', 'option-strategy-builder'],
    engine: 'margin-requirement',
  },
  {
    id: 'futures-fair-value',
    name: 'Futures Fair Value and Basis',
    shortDescription:
      'The no-arbitrage futures price, the basis, and the annualised cost of carry implied by an observed futures price.',
    category: 'derivatives',
    difficulty: 'advanced',
    formulas: [
      { latex: 'F = S e^{(r - q)T}', label: 'Fair futures price with continuous carry' },
      { latex: '\\text{Basis} = F - S, \\quad \\text{Annualised basis} = \\frac{F - S}{S}\\cdot\\frac{365}{\\text{days}}', label: 'Basis and its annualised form' },
    ],
    inputs: [
      money('spot', 'Spot index or asset price', 25000, { min: 1 }),
      num('days', 'Days to contract expiry', 30, { min: 1, max: 365 }),
      pct('riskFreeRate', 'Risk-free rate', 6.5, { min: 0, max: 20 }),
      pct('dividendYield', 'Dividend yield of the underlying', 1.2, { min: 0, max: 15 }),
      money('observedFutures', 'Observed futures price', 25120, { min: 1 }),
    ],
    workedExample:
      'With a 6.5% rate, a 1.2% dividend yield and 30 days to expiry, the fair futures price is about 25,109 — a basis of 109 points. If the futures trades at 25,120, the annualised basis is roughly 5.8% a year, which is close to the cost of carry and therefore offers no arbitrage to a retail participant who cannot borrow at the risk-free rate.',
    limitations: [
      'The replication requires financing at the risk-free rate, which an individual cannot obtain. A basis that looks exploitable is usually outside the reach of anyone who cannot fund the cash leg on wholesale terms.',
      'Indian index futures are cash-settled at expiry and stock futures are physically settled, which changes roll cost and risk materially.',
      'The fair-value relationship holds approximately and within transaction costs. Persistent deviations mostly reflect funding costs and market frictions, not free money.',
    ],
    relatedCalculators: ['margin-requirement', 'bond-price-yield', 'option-payoff'],
    engine: 'futures-fair-value',
  },
  {
    id: 'deposit-reinvestment-risk',
    name: 'Deposit Reinvestment Risk',
    shortDescription:
      'The effect of a rate change on a portfolio of deposits being rolled over — the reinvestment risk that price-based measures ignore.',
    category: 'fixed-income',
    difficulty: 'intermediate',
    formulas: [
      { latex: '\\text{Income}_t = \\sum_i B_i \\times r_t', label: 'Interest income at the prevailing rate' },
      { latex: '\\Delta\\text{Income} = \\text{Reinvested balance} \\times \\Delta r', label: 'Change in annual income' },
    ],
    inputs: [
      money('totalDeposits', 'Total deposits', 3000000, { min: 1 }),
      pct('currentRate', 'Current rate on the portfolio', 7.2, { min: 0, max: 20 }),
      pct('rateChange', 'Change in rates at renewal', -0.5, { min: -6, max: 6 }),
      pct('shareRenewing', 'Share of the portfolio renewing this year', 40, { min: 0, max: 100 }),
      pct('marginalRate', 'Marginal tax rate', 31.2, { min: 0, max: 50 }),
    ],
    workedExample:
      '₹30,00,000 at 7.2% earns ₹2,16,000 a year. If 40% renews at a rate 0.5 points lower, annual income falls by about ₹6,000, and post-tax by roughly ₹4,100. A laddering strategy deliberately spreads this exposure rather than accepting it all at once.',
    limitations: [
      'Deposits have no price risk in the conventional sense; their risk is reinvestment risk, which this calculator addresses directly.',
      'The tax on interest is charged as it accrues or is credited, regardless of whether the income has been received in cash.',
    ],
    relatedCalculators: ['bond-ladder', 'deposit-comparison', 'interest-rate-risk'],
    engine: 'deposit-reinvestment-risk',
  },
  {
    id: 'real-estate-fractional',
    name: 'Fractional Ownership Return',
    shortDescription:
      'Net return from a fractional real-estate platform unit after fees, the tax on distributions and the exit, with the platform risks stated.',
    category: 'alternatives',
    difficulty: 'advanced',
    formulas: [
      { latex: '\\text{Net yield} = \\frac{\\text{Rent} - \\text{platform fee} - \\text{asset costs}}{\\text{Invested amount}}', label: 'Net distribution yield' },
    ],
    inputs: [
      money('investment', 'Amount invested', 500000, { min: 1 }),
      pct('grossRentalYield', 'Gross rental yield on the asset', 7.5, { min: 0, max: 20 }),
      pct('vacancyRate', 'Vacancy and collection loss', 8, { min: 0, max: 40 }),
      pct('platformFee', 'Annual platform and management fee', 2, { min: 0, max: 6 }),
      pct('assetCosts', 'Property tax, insurance and maintenance', 8, { min: 0, max: 30, help: 'As a percentage of gross rent.' }),
      pct('appreciation', 'Assumed capital appreciation', 5, { min: -10, max: 20 }),
      num('years', 'Holding period', 5, { min: 1, max: 15 }),
      pct('marginalRate', 'Your marginal tax rate', 31.2, { min: 0, max: 50 }),
      pct('exitFee', 'Exit or transfer fee', 1, { min: 0, max: 5 }),
    ],
    workedExample:
      'A 7.5% gross yield reduced by 8% vacancy, 2% of investment as platform fees and 8% of gross rent as asset costs leaves a net distribution yield close to 5.3% before tax. Slab taxation of the distribution and an exit fee reduce the realised outcome further, and the platform usually has no obligation to buy the units back.',
    limitations: [
      'Fractional ownership platforms differ widely in legal structure. Where the platform is not registered as a small and medium REIT, the investor may hold a contractual claim rather than a registered interest in the property — a materially weaker position.',
      'There is no exchange, so the units may not be sellable at the stated valuation. The return is only real when the exit happens.',
      'Valuation is set by a valuer appointed by the platform. An unlisted, untraded asset has no independent price.',
    ],
    relatedCalculators: ['rental-yield', 'private-cashflow', 'property-xirr', 'risk-of-ruin'],
    engine: 'real-estate-fractional',
  },
  {
    id: 'inflation-erosion',
    name: 'Inflation Erosion of a Fixed Pension',
    shortDescription:
      'How a fixed nominal income loses purchasing power, and what escalation would be required to preserve it.',
    category: 'planning',
    difficulty: 'foundational',
    formulas: [
      { latex: '\\text{Real value}_T = \\frac{\\text{Fixed income}}{(1+\\pi)^T}', label: 'Purchasing power of a fixed nominal stream' },
      { latex: '\\text{Required growth} = \\pi', label: 'Escalation needed to hold real income constant' },
    ],
    inputs: [
      money('monthlyIncome', 'Fixed monthly income', 50000, { min: 1 }),
      pct('inflation', 'Inflation', 6, { min: 0, max: 20 }),
      num('years', 'Years', 20, { min: 1, max: 50 }),
    ],
    workedExample:
      '₹50,000 a month with no escalation buys what ₹15,590 buys after twenty years at 6% inflation — a loss of nearly seven-tenths of its purchasing power. This is the central argument against relying on a fixed pension or a fixed deposit interest stream for a long retirement.',
    limitations: [
      'Personal inflation for retirees tends to be driven by healthcare, which has historically risen faster than the general index, so the erosion is often worse than shown.',
    ],
    relatedCalculators: ['nominal-vs-real', 'real-return', 'annuity-vs-swp', 'purchasing-power'],
    engine: 'inflation-erosion',
  },
];
