/**
 * Calculator definitions — batch D: tax, small savings, property and business.
 */

const inp = (id, label, kind, def, extra = {}) => ({ id, label, kind, default: def, ...extra });
const money = (id, label, def, extra = {}) => inp(id, label, 'currency', def, { unit: '₹', min: 0, ...extra });
const pct = (id, label, def, extra = {}) => inp(id, label, 'percent', def, { unit: '%', ...extra });
const yrs = (id, label, def, extra = {}) => inp(id, label, 'years', def, { unit: 'years', min: 0, ...extra });
const num = (id, label, def, extra = {}) => inp(id, label, 'number', def, extra);

export default [
  {
    id: 'advance-tax-schedule',
    name: 'Advance Tax Schedule',
    shortDescription:
      'The quarterly instalments due on estimated annual tax, and the interest exposure if the schedule is missed.',
    category: 'tax',
    difficulty: 'intermediate',
    formulas: [
      { latex: '\\text{Cumulative due} = \\{15\\%, 45\\%, 75\\%, 100\\%\\} \\text{ of estimated liability}', label: 'Instalment percentages at 15 June, 15 September, 15 December and 15 March', assumption: 'For a taxpayer whose income is not entirely from business, only the first three dates fall due before the year ends.' },
    ],
    inputs: [
      money('estimatedTax', 'Estimated total tax for the year', 400000, { min: 0 }),
      money('tdsDeducted', 'TDS already deducted', 120000, { min: 0 }),
      pct('interestRate', 'Interest on shortfall', 1, { min: 0, max: 3, help: 'Interest is charged at 1% per month on the shortfall against each instalment.' }),
    ],
    workedExample:
      'With an estimated liability of ₹4,00,000 and ₹1,20,000 of TDS, the balance of ₹2,80,000 is payable as 15%, 45%, 75% and 100% cumulative instalments. Paying nothing until March triggers interest on each missed instalment.',
    limitations: [
      'Interest under s.234C is charged for three months on each shortfall instalment, and the computation is mechanical rather than discretionary.',
      'A taxpayer with presumptive business income has a single instalment on 15 March. The schedule here assumes income that is not entirely business income.',
    ],
    relatedCalculators: ['post-tax-return', 'tax-loss-harvesting'],
    engine: 'advance-tax-schedule',
  },
  {
    id: 'tax-loss-harvesting',
    name: 'Tax-Loss Harvesting Planner',
    shortDescription:
      'The tax saved by realising losses against gains in the same year, and how much loss can be carried forward.',
    category: 'tax',
    difficulty: 'advanced',
    formulas: [
      { latex: '\\text{Short-term loss} \\rightarrow \\text{STCG then LTCG}', label: 'Set-off order for short-term losses' },
      { latex: '\\text{Long-term loss} \\rightarrow \\text{LTCG only}', label: 'Long-term losses cannot offset short-term gains' },
    ],
    inputs: [
      money('shortTermGains', 'Realised short-term gains', 200000, { min: 0 }),
      money('longTermGains', 'Realised long-term gains', 500000, { min: 0 }),
      money('shortTermLosses', 'Available short-term losses', 150000, { min: 0 }),
      money('longTermLosses', 'Available long-term losses', 80000, { min: 0 }),
      pct('stcgRate', 'Rate on short-term gains', 20, { min: 0, max: 45 }),
      pct('ltcgRate', 'Rate on long-term gains', 12.5, { min: 0, max: 45 }),
      money('exemptionAvailable', 'LTCG exemption still unused', 0, { help: 'The ₹1,25,000 annual exemption on listed equity long-term gains is applied first.' }),
    ],
    workedExample:
      '₹2,00,000 of short-term gains set against ₹1,50,000 of short-term losses leaves ₹50,000 taxed at 20%. The ₹80,000 long-term loss can only be set against long-term gains, saving 12.5% of what it offsets — which is why a short-term loss is the more valuable loss to hold.',
    limitations: [
      'A loss on a listed equity position can be harvested and the position re-established, but the buy-back must respect the two-day settlement cycle and not be an attempt to manufacture a loss without changing economic exposure.',
      'Carry-forward requires the return to be filed by the due date under s.139(1). A belated return forfeits the carry-forward of losses entirely.',
      'Wash-sale rules do not exist in India in the form they take in the United States, but a transaction without economic substance can still be challenged.',
    ],
    relatedCalculators: ['post-tax-return', 'advance-tax-schedule'],
    engine: 'tax-loss-harvesting',
  },
  {
    id: 'ppf-calculator',
    name: 'PPF Calculator',
    shortDescription: 'Maturity value of a Public Provident Fund account with the statutory deposit pattern and rate resets.',
    category: 'planning',
    difficulty: 'foundational',
    formulas: [
      { latex: 'FV = \\sum_{t=0}^{14} D\\,(1+r)^{15-t}', label: 'Annual deposits compounded to maturity', assumption: 'The rate is declared each quarter and is not fixed for the term. The calculator uses one rate throughout.' },
    ],
    inputs: [
      money('annualDeposit', 'Annual deposit', 150000, { min: 500, max: 150000, help: 'There is a statutory annual ceiling on deposits.' }),
      pct('rate', 'Assumed rate of interest', 7.1, { min: 1, max: 15 }),
      yrs('years', 'Term in years', 15, { min: 15, max: 50 }),
    ],
    workedExample:
      '₹1,50,000 deposited each year for fifteen years at 7.1% matures at approximately ₹40.7 lakh. Because deposits and interest are both exempt, the entire amount is received without tax.',
    limitations: [
      'The interest rate changes quarterly. It has fallen over long stretches and is not guaranteed for the full term.',
      'Deposits are capped, so the tax advantage cannot be scaled. Above the cap, investors need a taxable alternative, and the comparison must be made after tax.',
    ],
    relatedCalculators: ['taxable-equivalent-yield', 'post-tax-return', 'retirement-corpus'],
    engine: 'ppf-calculator',
  },
  {
    id: 'epf-calculator',
    name: 'EPF Corpus Projection',
    shortDescription:
      'Projection of the Employees’ Provident Fund balance to retirement from employee and employer contributions.',
    category: 'planning',
    difficulty: 'intermediate',
    formulas: [
      { latex: 'B_{t+1} = B_t (1 + r/12) + (E + R)\\ \\text{monthly}', label: 'Monthly accrual of contributions and interest' },
    ],
    inputs: [
      money('monthlyBasic', 'Monthly basic salary plus dearness allowance', 60000, { min: 1 }),
      pct('employeeRate', 'Employee contribution', 12, { min: 0, max: 30 }),
      pct('employerRate', 'Employer contribution to EPF', 3.67, { min: 0, max: 15, help: 'Of the employer’s 12%, 8.33% of wages up to the statutory ceiling is diverted to the pension scheme.' }),
      money('currentBalance', 'Current EPF balance', 800000, { min: 0 }),
      pct('returnRate', 'Assumed EPF interest rate', 8.25, { min: 5, max: 12 }),
      num('yearsToRetirement', 'Years to retirement', 25, { min: 1, max: 45 }),
      pct('salaryGrowth', 'Annual salary growth', 7, { min: 0, max: 20 }),
    ],
    workedExample:
      'A ₹60,000 monthly basic with 12% employee and 3.67% employer contributions, growing 7% a year, accumulates several crore over twenty-five years at 8.25% — but the entire amount is received at the age of retirement or after, and premature withdrawal has tax consequences.',
    limitations: [
      'The EPF rate is declared annually by the Employees’ Provident Fund Organisation and is not contractual. The figure here is an assumption.',
      'The pension component of the employer’s contribution is not represented in this balance. It builds a separate, often small, pension entitlement.',
      'Salary growth assumptions dominate the result for long horizons. Treat the projection as an illustration of mechanics, not a forecast.',
    ],
    relatedCalculators: ['retirement-corpus', 'nps-calculator', 'ppf-calculator'],
    engine: 'epf-calculator',
  },
  {
    id: 'nps-calculator',
    name: 'NPS Calculator',
    shortDescription:
      'National Pension System corpus at retirement, the portion that must be annuitised, and the pension it buys.',
    category: 'planning',
    difficulty: 'intermediate',
    formulas: [
      { latex: '\\text{Corpus} = \\sum D\\,(1+r)^{n-t} \\quad\\text{then}\\quad 40\\% \\text{ to annuity}', label: 'Accumulation, then the statutory annuitisation requirement' },
    ],
    inputs: [
      money('monthlyContribution', 'Monthly contribution', 20000, { min: 500 }),
      pct('returnRate', 'Assumed return before retirement', 10, { min: 0, max: 20 }),
      num('yearsToRetirement', 'Years to retirement', 25, { min: 1, max: 45 }),
      money('currentCorpus', 'Existing NPS corpus', 500000, { min: 0 }),
      pct('annuityShare', 'Share annuitised at retirement', 40, { min: 40, max: 100 }),
      pct('annuityRate', 'Annuity rate available', 6.5, { min: 2, max: 12 }),
    ],
    workedExample:
      '₹20,000 a month for twenty-five years at 10% builds several crore. If 40% goes into an annuity returning 6.5%, the resulting pension is modest relative to the corpus — the annuitisation requirement is the most consequential design feature of the scheme and is frequently understated.',
    limitations: [
      'Annuity rates available at retirement are unknowable today. A one-percentage-point difference in the annuity rate changes the pension materially.',
      'The investment choice within NPS (equity, corporate debt, government securities and the alternative asset scheme) determines the return. The default lifecycle option automatically reduces equity exposure as retirement approaches, which lowers both risk and expected return.',
      'Tax treatment depends on the regime and on the share withdrawn as a lump sum, which has changed repeatedly. Check the rule in force for the year of withdrawal.',
    ],
    relatedCalculators: ['annuity-vs-swp', 'retirement-corpus', 'epf-calculator'],
    engine: 'nps-calculator',
  },
  {
    id: 'annuity-vs-swp',
    name: 'Annuity vs SWP',
    shortDescription:
      'Compares the certainty of an annuity with the flexibility and residual value of a withdrawal plan, over a stated horizon.',
    category: 'planning',
    difficulty: 'intermediate',
    formulas: [
      { latex: '\\text{Annuity income} = \\text{Corpus} \\times \\text{annuity rate on the annuitised share}', label: 'Annuity income' },
      { latex: 'B_t = (B_{t-1} - W)(1+r)', label: 'Withdrawal plan balance' },
    ],
    inputs: [
      money('corpus', 'Corpus available', 10000000, { min: 1 }),
      pct('annuityShare', 'Share annuitised', 100, { min: 0, max: 100 }),
      pct('annuityRate', 'Annuity rate', 6.5, { min: 2, max: 12 }),
      pct('withdrawalRate', 'Withdrawal rate in the alternative', 6, { min: 1, max: 20 }),
      pct('returnRate', 'Expected return on the invested corpus', 8.5, { min: -10, max: 20 }),
      yrs('years', 'Comparison horizon', 25, { min: 5, max: 45 }),
      pct('escalation', 'Annual increase in withdrawal', 0, { min: 0, max: 10 }),
    ],
    workedExample:
      '₹1,00,00,000 annuitised at 6.5% pays ₹6,50,000 a year for life, with nothing left to heirs unless a return-of-purchase-price option is chosen at a lower rate. A 6% withdrawal from a corpus returning 8.5% pays similar income, rises with the corpus, and leaves a balance in most paths — at the cost of carrying the risk of a bad sequence of returns.',
    limitations: [
      'An annuity transfers longevity and investment risk for a cost that is embedded in the rate rather than disclosed. Comparing the rate with a bond yield understates the cost.',
      'Indian annuity markets are thin. Rates available to an individual vary by provider, by option and by timing.',
      'The withdrawal plan figures assume a constant return; the annuity figures assume the insurer remains solvent for decades.',
    ],
    relatedCalculators: ['swp', 'risk-of-ruin', 'nps-calculator', 'retirement-corpus'],
    engine: 'annuity-vs-swp',
  },
  {
    id: 'sukanya-samriddhi',
    name: 'Sukanya Samriddhi Calculator',
    shortDescription: 'Maturity value of a Sukanya Samriddhi account given the deposit pattern and the declared rate.',
    category: 'planning',
    difficulty: 'foundational',
    formulas: [
      { latex: 'FV = \\sum_{t=0}^{14} D\\,(1+r)^{21-t}', label: 'Deposits for fifteen years, maturity at twenty-one years from opening' },
    ],
    inputs: [
      money('annualDeposit', 'Annual deposit', 150000, { min: 250, max: 150000 }),
      pct('rate', 'Assumed rate of interest', 8.2, { min: 1, max: 15 }),
      inp('irregular', 'Deposits continue for fifteen years', 'toggle', true),
    ],
    workedExample:
      '₹1,50,000 deposited each year for the first fifteen years at 8.2% matures around twenty-one years later at approximately ₹69 lakh, entirely exempt from tax.',
    limitations: [
      'The rate is set quarterly by the government and is not contractual for the life of the account.',
      'Withdrawal is permitted only for specific purposes, and the account is tied to a girl child as prescribed.',
      'The exemption is worth most to a high-slab parent, since a taxable alternative at the same rate would net less.',
    ],
    relatedCalculators: ['ppf-calculator', 'taxable-equivalent-yield', 'goal-planning'],
    engine: 'sukanya-samriddhi',
  },
  {
    id: 'term-insurance-need',
    name: 'Term Insurance Need',
    shortDescription:
      'The cover required to replace income, clear liabilities and fund future obligations, less what already exists.',
    category: 'planning',
    difficulty: 'foundational',
    formulas: [
      { latex: '\\text{Cover} = \\left(\\text{Income} \\times Y\\right) + \\text{Liabilities} + \\text{Future goals} - \\text{Liquid assets} - \\text{Existing cover}', label: 'Human-life-value approach' },
    ],
    inputs: [
      money('annualIncome', 'Annual income to replace', 2400000, { min: 1 }),
      num('yearsToReplace', 'Years of income replacement', 15, { min: 1, max: 40 }),
      money('outstandingLoans', 'Outstanding loans', 6000000, { min: 0 }),
      money('futureGoals', 'Future obligations (education, care)', 3000000, { min: 0 }),
      money('liquidAssets', 'Liquid assets and existing investments', 2500000, { min: 0 }),
      money('existingCover', 'Existing life cover', 10000000, { min: 0 }),
      pct('inflation', 'Inflation assumption for income replacement', 5, { min: 0, max: 15 }),
    ],
    workedExample:
      'The calculation typically shows a requirement far above the employer’s group cover, which ends with the job. Term cover is the cheapest component of a financial plan and the one most often under-bought, because it produces no visible benefit while alive.',
    limitations: [
      'Income replacement should be discounted, not simply multiplied: the family needs ₹X a year for Y years, and the corpus can earn a return in the meantime. This calculator uses a simpler undiscounted approach and therefore overstates the requirement slightly, which is a conservative error.',
      'Term insurance is not an investment. It has no surrender value and pays nothing if the term ends without a claim — and that is the product working as designed.',
    ],
    relatedCalculators: ['emergency-fund', 'retirement-corpus', 'opportunity-cost'],
    engine: 'term-insurance-need',
  },
  {
    id: 'rental-yield',
    name: 'Rental Yield Calculator',
    shortDescription:
      'Gross and net rental yield after vacancy, maintenance, property tax and the tax on rent — the two figures are usually two percentage points apart.',
    category: 'real-estate',
    difficulty: 'intermediate',
    formulas: [
      { latex: '\\text{Gross yield} = \\frac{\\text{Annual rent}}{\\text{Price}}' },
      { latex: '\\text{Net yield} = \\frac{\\text{Rent} - \\text{costs} - \\text{tax}}{\\text{Total cost}}', label: 'Measured against all-in acquisition cost, not headline price' },
    ],
    inputs: [
      money('price', 'Property price', 8000000, { min: 1 }),
      money('monthlyRent', 'Monthly rent', 25000, { min: 0 }),
      num('vacancyMonths', 'Expected vacancy per year', 1, { min: 0, max: 12 }),
      money('annualMaintenance', 'Annual maintenance and repairs', 60000, { min: 0 }),
      money('annualPropertyTax', 'Annual property tax', 15000, { min: 0 }),
      money('societyCharges', 'Annual society charges borne by owner', 36000, { min: 0 }),
      pct('marginalRate', 'Your marginal tax rate', 31.2, { min: 0, max: 50 }),
      pct('stampDuty', 'Stamp duty and registration', 6, { min: 0, max: 15 }),
    ],
    workedExample:
      'A ₹80,00,000 flat let for ₹25,000 a month has a gross yield of 3.75%. After one month of vacancy, maintenance, society charges, property tax and the tax on rental income, the net yield on the all-in cost is close to 1.9% — before any capital appreciation and before the property is ever sold.',
    limitations: [
      'Interiors, furnishing and capital replacements are excluded unless entered as maintenance. They are frequently substantial in the first year.',
      'The 30% statutory deduction from net annual value is a tax provision, not an economic cost, and the calculator applies the real cash costs separately.',
    ],
    relatedCalculators: ['property-xirr', 'property-leverage', 'yield-on-cost', 'opportunity-cost'],
    engine: 'rental-yield',
  },
  {
    id: 'property-xirr',
    name: 'Property Return (XIRR)',
    shortDescription:
      'The money-weighted return on a property purchase, including stamp duty, leverage, rent, costs and the tax on exit.',
    category: 'real-estate',
    difficulty: 'advanced',
    formulas: [
      { latex: '\\sum \\frac{CF_t}{(1+r)^{t}} = 0', label: 'XIRR on the investor’s own equity' },
      { latex: '\\Delta C = \\text{Stamp duty} + \\text{Registration} + \\text{Brokerage} + \\text{Interiors}', label: 'Incidental acquisition cost, typically 7–12% of price' },
    ],
    inputs: [
      money('price', 'Property price', 8000000, { min: 1 }),
      pct('stampDuty', 'Stamp duty and registration', 6, { min: 0, max: 15 }),
      pct('brokerage', 'Purchase brokerage', 1, { min: 0, max: 3 }),
      money('interiors', 'Interior and fit-out spend', 600000, { min: 0 }),
      money('loanAmount', 'Home loan amount', 6400000, { min: 0 }),
      pct('loanRate', 'Home loan interest rate', 8.6, { min: 5, max: 18 }),
      num('loanTenureMonths', 'Loan tenure in months', 240, { min: 12, max: 360 }),
      money('monthlyRent', 'Monthly rent received', 25000, { min: 0 }),
      pct('rentGrowth', 'Annual rent growth', 5, { min: 0, max: 20 }),
      num('vacancyMonths', 'Vacancy months per year', 1, { min: 0, max: 12 }),
      pct('appreciation', 'Assumed annual price appreciation', 7, { min: -10, max: 25 }),
      yrs('holdingYears', 'Holding period', 10, { min: 1, max: 35 }),
      pct('marginalRate', 'Marginal tax rate on rent', 31.2, { min: 0, max: 50 }),
      pct('capitalGainsRate', 'Capital gains tax rate on sale', 12.5, { min: 0, max: 30 }),
    ],
    workedExample:
      'A ₹80,00,000 flat with a 6% stamp duty bill, ₹6,00,000 of interiors and 80% leverage, held ten years with rent growing 5% and prices appreciating 7%, produces an equity XIRR that is frequently lower than the appreciation rate — leverage and transaction costs work in both directions.',
    limitations: [
      'Appreciation is the dominant input and the least knowable. Property has no continuous price series in India, so the assumed rate is a belief rather than an observation.',
      'The model assumes the property is sold in a single year and the gains taxed in that year. It excludes the indexation option available for property acquired before 23 July 2024 and any capital-gains exemption on reinvestment.',
      'It excludes the interest deduction available against rental income under the old regime, which improves the after-tax result for itemising taxpayers.',
    ],
    relatedCalculators: ['rental-yield', 'property-leverage', 'emi', 'loan-amortisation'],
    engine: 'property-xirr',
  },
  {
    id: 'property-leverage',
    name: 'Leverage Effect on Returns',
    shortDescription:
      'How borrowing amplifies the return on equity — in both directions — and the asset return at which the equity return is zero.',
    category: 'real-estate',
    difficulty: 'intermediate',
    formulas: [
      { latex: 'r_{equity} = \\frac{r_{asset} - LTV \\times r_{debt}}{1 - LTV}', label: 'Return on equity with a mortgage' },
    ],
    inputs: [
      pct('assetReturn', 'Asset return (appreciation plus net yield)', 8, { min: -20, max: 30 }),
      pct('loanToValue', 'Loan to value', 80, { min: 0, max: 95 }),
      pct('debtCost', 'Interest rate on the loan', 8.6, { min: 3, max: 20 }),
    ],
    workedExample:
      'With an 80% loan at 8.6% and an 8% asset return, the equity return is 5.6% — leverage costs money when the asset return is below the borrowing cost. At a 12% asset return, the same loan turns it into a 25.6% equity return, which is the mechanism behind every story of property making people rich.',
    limitations: [
      'Leverage is symmetric in mathematics and asymmetric in life: a 20% price fall with 80% leverage wipes out the entire equity while the loan remains fully repayable.',
      'The loan-to-value figure here is the effective one at sale; costs of borrowing, insurance and the requirement to pledge the property are excluded.',
      'Real estate leverage is not callable in the way a margin loan is, which makes it more survivable — but only if the cash flow servicing it also survives.',
    ],
    relatedCalculators: ['property-xirr', 'emi', 'margin-requirement', 'max-drawdown'],
    engine: 'property-leverage',
  },
  {
    id: 'emi',
    name: 'EMI Calculator',
    shortDescription: 'Equated monthly instalment, total interest and the amortisation profile of a reducing-balance loan.',
    category: 'real-estate',
    difficulty: 'foundational',
    formulas: [
      { latex: 'EMI = \\frac{P \\, r \\, (1+r)^n}{(1+r)^n - 1}, \\quad r = \\frac{\\text{annual rate}}{12}', label: 'Reducing-balance instalment' },
    ],
    inputs: [
      money('principal', 'Loan amount', 5000000, { min: 1 }),
      pct('annualRate', 'Annual interest rate', 8.6, { min: 0.5, max: 30 }),
      num('months', 'Tenure in months', 240, { min: 1, max: 480 }),
    ],
    workedExample:
      '₹50,00,000 at 8.6% over 240 months is an EMI of about ₹43,750 and total interest of roughly ₹55 lakh. Extending the tenure to 360 months lowers the EMI to about ₹38,800 but raises total interest above ₹89 lakh.',
    limitations: [
      'A longer tenure reduces the monthly burden and increases the total cost. Lenders quote the first figure; the second is what you pay.',
      'Most Indian home loans charge interest monthly on the outstanding balance with no prepayment penalty on floating-rate loans, so partial prepayments early in the tenure have an outsized effect.',
    ],
    relatedCalculators: ['loan-amortisation', 'property-leverage', 'emergency-fund'],
    engine: 'emi',
  },
  {
    id: 'loan-amortisation',
    name: 'Loan Amortisation and Prepayment',
    shortDescription:
      'The full year-by-year schedule, and how much interest a regular prepayment saves over the life of the loan.',
    category: 'debt',
    difficulty: 'intermediate',
    formulas: [
      { latex: '\\text{Interest}_t = B_{t-1} \\times \\frac{r}{12}', label: 'Interest for the month' },
      { latex: '\\text{Principal}_t = \\text{EMI} - \\text{Interest}_t', label: 'Principal component' },
    ],
    inputs: [
      money('principal', 'Loan amount', 5000000, { min: 1 }),
      pct('annualRate', 'Annual interest rate', 8.6, { min: 0.5, max: 30 }),
      num('months', 'Original tenure in months', 240, { min: 1, max: 480 }),
      money('extraMonthly', 'Extra monthly payment', 5000, { min: 0 }),
      pct('prepaymentYear', 'One-time prepayment year (0 for none)', 0, { min: 0, max: 30 }),
      money('prepaymentAmount', 'One-time prepayment amount', 0, { min: 0 }),
    ],
    workedExample:
      'On a ₹50,00,000 loan at 8.6% for 240 months, an extra ₹5,000 a month closes the loan several years early and saves interest in the tens of lakhs, because every extra rupee is applied to principal and removes all future interest on that principal.',
    limitations: [
      'Prepaying a home loan competes with investing the same money. At an 8.6% cost of debt and an assumed 11% equity return, investing wins on average — but prepayment is a certain 8.6% return and investing is not certain at all.',
      'Tax benefits on home-loan interest (in the old regime) reduce the effective cost of the loan and therefore reduce the benefit of prepaying.',
    ],
    relatedCalculators: ['emi', 'opportunity-cost', 'property-xirr'],
    engine: 'loan-amortisation',
  },
  {
    id: 'business-investment',
    name: 'Business Investment Return',
    shortDescription:
      'Return on capital invested in an operating business, with payback period and the sensitivity to the assumptions.',
    category: 'alternatives',
    difficulty: 'advanced',
    formulas: [
      { latex: 'CF_t = \\text{Revenue}_t (1 - \\text{COGS}) - \\text{Operating costs}_t', label: 'Annual cash flow' },
      { latex: 'IRR: \\sum \\frac{CF_t}{(1+r)^t} - \\text{Initial} = 0', label: 'Internal rate of return on the invested capital' },
    ],
    inputs: [
      money('initialCapital', 'Initial capital invested', 5000000, { min: 1 }),
      money('annualRevenue', 'Annual revenue at full capacity', 12000000, { min: 0 }),
      pct('cogsPercent', 'Cost of goods and services', 55, { min: 0, max: 100 }),
      money('annualOperatingCosts', 'Annual fixed operating costs', 2400000, { min: 0 }),
      yrs('rampUpYears', 'Years to reach full revenue', 1, { min: 0, max: 5 }),
      yrs('years', 'Evaluation horizon', 7, { min: 1, max: 25 }),
      money('terminalValue', 'Terminal value at the end (sale or salvage)', 5000000, { min: 0 }),
      pct('taxRate', 'Effective tax rate on profits', 25, { min: 0, max: 50 }),
    ],
    workedExample:
      'A ₹50,00,000 investment producing ₹1.2 crore of revenue at a 45% gross margin and ₹24,00,000 of fixed costs generates about ₹30,00,000 of pre-tax operating cash flow at full capacity. After tax, the capital is returned in roughly three years, and the IRR over seven years with a ₹50,00,000 terminal value exceeds 30% — if the revenue assumption holds.',
    limitations: [
      'Revenue is the assumption that matters most and the one with no market price to check against. A 20% revenue shortfall can eliminate the entire return.',
      'It excludes the owner’s own labour. If the owner manages the business full time, that cost should be deducted before computing a return on capital.',
      'It excludes working-capital requirements, which are the most common cause of failure in otherwise profitable small businesses.',
    ],
    relatedCalculators: ['private-cashflow', 'franchise-return', 'opportunity-cost', 'risk-of-ruin'],
    engine: 'business-investment',
  },
  {
    id: 'private-cashflow',
    name: 'Private Investment Cash Flow',
    shortDescription:
      'XIRR and multiples for an illiquid investment with staged capital calls and a single exit.',
    category: 'alternatives',
    difficulty: 'advanced',
    formulas: [
      { latex: '\\text{DPI} = \\frac{\\text{Distributions}}{\\text{Paid-in capital}}', label: 'Distributions to paid-in capital: cash actually returned' },
      { latex: '\\text{TVPI} = \\frac{\\text{Distributions} + \\text{Residual value}}{\\text{Paid-in capital}}', label: 'Total value to paid-in capital: includes marks, not cash' },
    ],
    inputs: [
      money('call1', 'Capital call 1', 1000000, { min: 0 }),
      inp('date1', 'Date of call 1', 'date', '2020-01-01'),
      money('call2', 'Capital call 2', 1000000, { min: 0 }),
      inp('date2', 'Date of call 2', 'date', '2022-01-01'),
      money('distribution', 'Total distributions received', 500000, { min: 0 }),
      inp('dateDistribution', 'Date of distributions', 'date', '2026-01-01'),
      money('residualValue', 'Current estimated residual value', 3000000, { min: 0 }),
      inp('dateValuation', 'Valuation date', 'date', '2026-10-01'),
    ],
    workedExample:
      '₹20,00,000 called over two years, ₹5,00,000 distributed and a ₹30,00,000 stated residual value gives a TVPI of 1.75× and a DPI of 0.25×. The second number is the one that has been realised; the first depends on a valuation nobody has tested with a sale.',
    limitations: [
      'Residual values in Indian private markets are marks, not prices. They are set by the manager’s valuer and may not be realisable.',
      'The J-curve means early-year IRRs are meaningless: fees are paid and no value is returned. Judge private investments by vintage year, not by reporting date.',
      'No secondary market exists for most Indian fund interests, so the position cannot be exited at the stated value.',
    ],
    relatedCalculators: ['business-investment', 'xirr', 'risk-of-ruin'],
    engine: 'private-cashflow',
  },
  {
    id: 'franchise-return',
    name: 'Franchise Economics',
    shortDescription:
      'Payback period and return on capital for a franchised outlet, including the fee and royalty that make franchise economics distinctive.',
    category: 'alternatives',
    difficulty: 'advanced',
    formulas: [
      { latex: '\\text{Payback} = \\frac{\\text{Total capital}}{\\text{Annual net cash flow}}', label: 'Simple payback period' },
      { latex: '\\text{Net cash flow} = \\text{Revenue}(1 - \\text{COGS} - \\text{royalty}) - \\text{fixed costs}', label: 'Cash flow after the royalty' },
    ],
    inputs: [
      money('franchiseFee', 'One-time franchise fee', 1500000, { min: 0 }),
      money('capex', 'Fit-out and equipment', 3500000, { min: 0 }),
      money('monthlyRevenue', 'Monthly revenue', 1800000, { min: 0 }),
      pct('grossMargin', 'Gross margin before royalty', 60, { min: 0, max: 95 }),
      pct('royaltyPercent', 'Royalty on revenue', 6, { min: 0, max: 20 }),
      money('monthlyFixedCosts', 'Monthly fixed costs (rent, staff, utilities)', 700000, { min: 0 }),
      yrs('years', 'Evaluation horizon', 5, { min: 1, max: 15 }),
      pct('terminalMultiple', 'Resale value as multiple of annual cash flow', 2, { min: 0, max: 6 }),
    ],
    workedExample:
      '₹15,00,000 of franchise fee plus ₹35,00,000 of fit-out, against ₹18,00,000 monthly revenue at a 60% gross margin less a 6% royalty and ₹7,00,000 of fixed monthly costs, produces roughly ₹21,00,000 of annual pre-tax cash flow — a payback of under three years before tax. The royalty is charged on revenue, not profit, so it hurts most in the months revenue is weak.',
    limitations: [
      'Revenue assumptions come from the franchisor’s projection, which is usually an optimistic case and is not a warranty.',
      'The agreement typically restricts the territory, the pricing and the suppliers, and provides no protection if the brand declines. Franchise renewal terms and exit clauses deserve as much attention as the projections.',
      'Owner-operated franchise outlets frequently understate the value of the owner’s time in the cash-flow estimates.',
    ],
    relatedCalculators: ['business-investment', 'private-cashflow', 'opportunity-cost'],
    engine: 'franchise-return',
  },
  {
    id: 'reit-distribution',
    name: 'REIT / InvIT Post-Tax Yield',
    shortDescription:
      'The after-tax yield on a trust unit once the distribution is separated into interest, dividend and capital repayment — three components taxed in three different ways.',
    category: 'real-estate',
    difficulty: 'advanced',
    formulas: [
      { latex: '\\text{Interest} \\rightarrow \\text{slab}, \\quad \\text{Dividend} \\rightarrow \\text{slab or exempt}, \\quad \\text{Capital repayment} \\rightarrow \\text{not income}', label: 'Tax treatment by component', assumption: 'The split between components is disclosed with each distribution and changes from quarter to quarter.' },
    ],
    inputs: [
      money('unitPrice', 'Price per unit', 140, { min: 1 }),
      money('distributionPerUnit', 'Annual distribution per unit', 9.5, { min: 0 }),
      pct('interestShare', 'Interest share of distribution', 55, { min: 0, max: 100 }),
      pct('dividendShare', 'Dividend share of distribution', 30, { min: 0, max: 100 }),
      pct('marginalRate', 'Your marginal tax rate', 31.2, { min: 0, max: 50 }),
      num('units', 'Number of units held', 7000, { min: 1 }),
    ],
    workedExample:
      'A ₹140 unit distributing ₹9.50 a year has a nominal yield of 6.8%. If 55% is interest taxed at a 31.2% marginal rate, 30% is dividend taxed at the same rate and 15% is capital repayment that is not taxed at all but reduces the cost basis, the immediate cash tax is about 1.6 points of the yield — and the deferred tax appears as a larger capital gain at sale.',
    limitations: [
      'Capital repayment reduces the cost of acquisition, so it increases the capital gain when the units are eventually sold. It is deferred tax, not exempt income.',
      'The component split varies each quarter and is disclosed in the distribution announcement, not in advance. The shares entered here are an assumption.',
      'REIT unit prices can fall. A distribution yield on a falling unit price is not a return.',
    ],
    relatedCalculators: ['post-tax-return', 'yield-on-cost', 'gold-comparison'],
    engine: 'reit-distribution',
  },
  {
    id: 'gold-comparison',
    name: 'Gold Vehicle Comparison',
    shortDescription:
      'The same gold exposure through physical, ETF, fund of funds and sovereign gold bonds, compared after all costs and taxes.',
    category: 'alternatives',
    difficulty: 'intermediate',
    formulas: [
      { latex: '\\text{Net} = \\text{Price growth} + \\text{Coupon} - \\text{Expense} - \\text{Making charges} - \\text{Tax}', label: 'Net outcome by vehicle' },
    ],
    inputs: [
      money('amount', 'Amount to invest', 500000, { min: 1 }),
      pct('goldGrowth', 'Assumed annual gold price growth', 9, { min: -20, max: 30 }),
      yrs('years', 'Holding period', 10, { min: 1, max: 25 }),
      pct('makingCharges', 'Making charges and wastage on physical gold', 12, { min: 0, max: 35 }),
      pct('buybackDiscount', 'Buyback discount on physical gold', 3, { min: 0, max: 15 }),
      pct('etfExpense', 'Gold ETF expense ratio', 0.5, { min: 0, max: 2 }),
      pct('sgbCoupon', 'Sovereign gold bond coupon', 2.5, { min: 0, max: 5 }),
      pct('marginalRate', 'Your marginal tax rate', 31.2, { min: 0, max: 50 }),
      pct('ltcgRate', 'Capital gains rate on gold funds', 12.5, { min: 0, max: 40 }),
    ],
    workedExample:
      'On ₹5,00,000 of gold over ten years with 9% price growth, physical gold loses 12% to making charges and 3% to the buyback discount, while a gold ETF pays around 0.5% a year and is taxed at 12.5% on the gain. The sovereign gold bond pays a 2.50% coupon that is taxable and exempts the redemption gain — the coupon taxation often goes unmentioned.',
    limitations: [
      'New sovereign gold bond tranches are not always open; the secondary market price may be materially above net asset value, which is a cost of entry.',
      'Physical gold is the only version with no counterparty; every paper claim on gold depends on a custodian and a legal structure.',
      'Gold produces no cash flow. Over long horizons its return has depended on the valuation at which the holding period began.',
    ],
    relatedCalculators: ['post-tax-return', 'real-return', 'portfolio-allocation'],
    engine: 'gold-comparison',
  },
  {
    id: 'currency-impact',
    name: 'Currency Impact on Foreign Returns',
    shortDescription:
      'How rupee depreciation or appreciation changes the return on an overseas investment, and how much of that return was currency.',
    category: 'returns',
    difficulty: 'intermediate',
    formulas: [
      { latex: '1 + r_{INR} = (1 + r_{foreign})(1 + \\Delta_{INR/USD})', label: 'Rupee return on a foreign asset' },
      { latex: '\\text{Currency contribution} \\approx \\Delta_{INR/USD}', label: 'The part of the return that came from the exchange rate' },
    ],
    inputs: [
      pct('foreignReturn', 'Return in the foreign currency', 10, { min: -40, max: 60 }),
      pct('inrDepreciation', 'Rupee depreciation against the foreign currency', 3, { min: -20, max: 25, help: 'A positive number means the rupee weakened.' }),
      yrs('years', 'Holding period', 10, { min: 0.5, max: 40 }),
      pct('fundExpense', 'Additional cost of the Indian route (fund expenses, if any)', 0.5, { min: 0, max: 3 }),
      pct('taxRate', 'Tax rate on the gain in India', 12.5, { min: 0, max: 40 }),
    ],
    workedExample:
      'A 10% foreign-currency return with 3% annual rupee depreciation produces roughly 13.3% a year in rupees. Over ten years the currency contributes about half of the cumulative gain — which is why an Indian investor’s experience of foreign equity is often better than the foreign index.',
    limitations: [
      'Currency movements are not a reliable return component. Depreciation has helped Indian investors on average over long periods, but it can reverse over any individual holding period.',
      'The tax rate on foreign equity and funds depends on the asset type, the holding period and whether the fund is India-domiciled. Verify the applicable treatment for the specific route used.',
    ],
    relatedCalculators: ['post-tax-return', 'multi-asset', 'real-return'],
    engine: 'currency-impact',
  },
];
