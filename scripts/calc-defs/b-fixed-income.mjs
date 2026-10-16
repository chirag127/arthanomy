/**
 * Calculator definitions — batch B: fixed income, credit and peer-to-peer lending.
 */

const inp = (id, label, kind, def, extra = {}) => ({ id, label, kind, default: def, ...extra });
const money = (id, label, def, extra = {}) => inp(id, label, 'currency', def, { unit: '₹', min: 0, ...extra });
const pct = (id, label, def, extra = {}) => inp(id, label, 'percent', def, { unit: '%', ...extra });
const yrs = (id, label, def, extra = {}) => inp(id, label, 'years', def, { unit: 'years', min: 0, ...extra });
const num = (id, label, def, extra = {}) => inp(id, label, 'number', def, extra);
const FREQ = {
  id: 'frequency',
  label: 'Coupon frequency per year',
  kind: 'select',
  default: '2',
  options: [
    { value: '1', label: 'Annual (1)' },
    { value: '2', label: 'Half-yearly (2)' },
    { value: '4', label: 'Quarterly (4)' },
    { value: '12', label: 'Monthly (12)' },
  ],
};

export default [
  {
    id: 'deposit-comparison',
    name: 'Deposit Comparison',
    shortDescription:
      'Compares fixed deposits, corporate deposits and small-savings schemes on a post-tax, post-inflation basis rather than on headline rates.',
    category: 'fixed-income',
    difficulty: 'foundational',
    formulas: [
      { latex: 'r_{net} = r(1-\\tau) - \\pi', label: 'Approximate post-tax real return' },
      { latex: 'r_{net} = \\frac{1 + r(1-\\tau)}{1+\\pi} - 1', label: 'Exact form used here' },
    ],
    inputs: [
      money('amount', 'Amount deposited', 1000000, { min: 1 }),
      pct('rateA', 'Rate on option A', 7.25, { min: 0, max: 20 }),
      pct('rateB', 'Rate on option B', 8.5, { min: 0, max: 25 }),
      pct('marginalRate', 'Your marginal tax rate including cess', 31.2, { min: 0, max: 50 }),
      pct('inflation', 'Assumed inflation', 6, { min: 0, max: 25 }),
      yrs('years', 'Holding period', 5, { min: 1, max: 30 }),
    ],
    workedExample:
      'A 7.25% bank deposit and an 8.50% corporate deposit differ by 1.25 points before tax. At a 31.2% marginal rate the gap narrows to 0.86 points, and at 6% inflation both are only marginally positive in real terms — while the corporate deposit carries credit risk the bank deposit does not.',
    limitations: [
      'A higher rate on a corporate deposit is payment for credit risk. The comparison is incomplete unless the default risk is priced; one default in five years can erode more than the entire spread.',
      'Interest on deposits is taxed every year on accrual, even if the deposit pays at maturity. The tax drag therefore compounds.',
    ],
    relatedCalculators: ['post-tax-return', 'break-even-inflation', 'default-recovery'],
    engine: 'deposit-comparison',
  },
  {
    id: 'bond-price-yield',
    name: 'Bond Price and Yield',
    shortDescription:
      'Prices a bond from its yield, or backs out the yield from an observed price, using the standard present-value relationship.',
    category: 'fixed-income',
    difficulty: 'intermediate',
    formulas: [
      { latex: 'P = \\sum_{k=1}^{n} \\frac{C/f}{(1+y/f)^{k}} + \\frac{F}{(1+y/f)^{n}}', label: 'Price from yield, per 100 of face value' },
      { latex: '\\text{Gain} = -D_{mod}\\,\\Delta y\\,P + \\tfrac{1}{2}C_{v}(\\Delta y)^2 P', label: 'Price change from a yield move, with convexity' },
    ],
    inputs: [
      money('faceValue', 'Face value', 1000, { min: 1 }),
      pct('couponRate', 'Coupon rate', 7.18, { min: 0, max: 25 }),
      yrs('yearsToMaturity', 'Years to maturity', 10, { min: 0.08, max: 40 }),
      FREQ,
      pct('yieldRequired', 'Yield to maturity', 7.0, { min: 0.1, max: 40 }),
      money('observedPrice', 'Observed price per ₹100 face (optional)', 100, { help: 'Enter a price to solve for the yield it implies. Leave at 100 to ignore.' }),
    ],
    workedExample:
      'A 10-year bond with a 7.18% coupon priced to yield 7.00% trades around ₹101.3 per ₹100 of face value. Raise the required yield to 8% and the same bond falls to about ₹94.4 — a 6.8% price loss from a one-percentage-point move in yields.',
    limitations: [
      'This assumes settlement on a coupon date or a stated accrued fraction, par redemption, and no embedded options. For callable, puttable or amortising bonds, use the effective duration from repricing at shifted yields.',
      'Indian bond quotes vary between clean and dirty price, and conventions differ between G-secs, corporate bonds and money-market instruments. Confirm the convention before comparing.',
    ],
    relatedCalculators: ['modified-duration', 'convexity', 'interest-rate-risk', 'credit-spread'],
    engine: 'bond-price-yield',
  },
  {
    id: 'bond-ladder',
    name: 'Bond Ladder Planner',
    shortDescription:
      'Builds a maturity ladder so that a known amount of principal returns each year, reducing reinvestment timing risk.',
    category: 'fixed-income',
    difficulty: 'intermediate',
    formulas: [
      { latex: 'A_{rung} = \\frac{\\text{Total}}{n}', label: 'Equal rung size for n rungs' },
      { latex: 'B_t = B_{t-1}(1+y) - W', label: 'Ladder balance with withdrawals' },
    ],
    inputs: [
      money('total', 'Total amount to invest', 3000000, { min: 1 }),
      num('rungs', 'Number of rungs (years)', 5, { min: 1, max: 20 }),
      pct('yieldRate', 'Assumed yield across the ladder', 7.2, { min: 0, max: 20 }),
      money('annualWithdrawal', 'Annual withdrawal from maturing rung', 0, { help: 'Enter 0 to reinvest each maturity.' }),
    ],
    workedExample:
      '₹30,00,000 split across five annual rungs puts ₹6,00,000 into each. Every year one rung matures and is reinvested at the then-prevailing rate, which caps the damage from investing the whole amount at a single, possibly inopportune, time.',
    limitations: [
      'A ladder does not remove interest-rate risk; it spreads it across time. If rates fall permanently, the later rungs are reinvested at lower yields.',
      'Indian bonds are not always available in every maturity for every credit quality. A practical ladder in corporate bonds may have to accept uneven rungs or a higher concentration in G-secs.',
    ],
    relatedCalculators: ['bond-price-yield', 'modified-duration', 'rebalancing'],
    engine: 'bond-ladder',
  },
  {
    id: 'modified-duration',
    name: 'Duration Calculator',
    shortDescription:
      'Macaulay, modified and effective duration for a bond, plus the price value of a basis point.',
    category: 'fixed-income',
    difficulty: 'advanced',
    formulas: [
      { latex: 'D_{Mac} = \\frac{\\sum t_k \\cdot PV_k}{P}', label: 'Macaulay duration, in years' },
      { latex: 'D_{mod} = \\frac{D_{Mac}}{1 + y/f}', label: 'Modified duration' },
      { latex: 'DV01 = D_{mod} \\times P \\times 0.0001', label: 'Price value of one basis point' },
    ],
    inputs: [
      pct('couponRate', 'Coupon rate', 7.18, { min: 0, max: 25, }),
      yrs('yearsToMaturity', 'Years to maturity', 10, { min: 0.25, max: 40 }),
      FREQ,
      pct('yieldRequired', 'Yield to maturity', 7.0, { min: 0.1, max: 40 }),
      money('faceValue', 'Face value', 1000000, { min: 1 }),
    ],
    workedExample:
      'A ten-year 7.18% semi-annual bond at a 7% yield has a Macaulay duration near 7.4 years and a modified duration near 7.15. A one-basis-point fall in yield therefore raises its price by roughly 0.0715%, or ₹715 on ₹10,00,000 of face value.',
    limitations: [
      'Duration is a linear approximation. For yield moves beyond about 50 basis points, convexity matters and the linear estimate understates the gain and overstates the loss.',
      'For bonds with embedded options or floating rates, modified duration is the wrong measure. Use effective duration computed by repricing.',
    ],
    relatedCalculators: ['convexity', 'interest-rate-risk', 'bond-price-yield'],
    engine: 'modified-duration',
  },
  {
    id: 'convexity',
    name: 'Convexity Calculator',
    shortDescription:
      'Second-order interest-rate sensitivity, and how much the convexity term improves the estimate of a price change.',
    category: 'fixed-income',
    difficulty: 'advanced',
    formulas: [
      { latex: 'C_v = \\frac{P_{+} + P_{-} - 2P_0}{P_0 (\\Delta y)^2}', label: 'Convexity from repricing at ±Δy' },
      { latex: '\\frac{\\Delta P}{P} \\approx -D_{mod}\\Delta y + \\tfrac{1}{2}C_v (\\Delta y)^2', label: 'Duration plus convexity' },
    ],
    inputs: [
      pct('couponRate', 'Coupon rate', 7.18, { min: 0, max: 25 }),
      yrs('yearsToMaturity', 'Years to maturity', 10, { min: 0.25, max: 40 }),
      FREQ,
      pct('yieldRequired', 'Yield to maturity', 7.0, { min: 0.1, max: 40 }),
      num('shockBps', 'Yield shock in basis points', 200, { min: -500, max: 500, help: 'Positive means yields rise.' }),
    ],
    workedExample:
      'For a ten-year 7.18% bond at a 7% yield, a 200-basis-point rise in yields produces a loss of roughly 13.2% by duration alone, but about 12.1% once convexity is included. The difference is why long-dated bonds recover faster than the linear estimate implies.',
    limitations: [
      'Convexity is valuable, and it is paid for. A bond with higher convexity usually offers a lower yield — the benefit is priced, not free.',
      'A single convexity number is inadequate across a large yield shock or across many maturities. Key-rate durations are required for a portfolio spread across the curve.',
    ],
    relatedCalculators: ['modified-duration', 'interest-rate-risk'],
    engine: 'convexity',
  },
  {
    id: 'credit-spread',
    name: 'Credit Spread Calculator',
    shortDescription:
      'The spread over a benchmark yield, the default probability it implies, and the compensation it provides for expected loss.',
    category: 'fixed-income',
    difficulty: 'advanced',
    formulas: [
      { latex: 's = y_{risky} - y_{benchmark}', label: 'Spread to benchmark' },
      { latex: 's \\approx PD \\times LGD', label: 'Break-even spread, a first approximation', assumption: 'Exact only for small probabilities and short horizons; the exact form is computed by discounting survival and default legs.' },
    ],
    inputs: [
      pct('riskyYield', 'Corporate bond yield', 9.5, { min: 0, max: 40 }),
      pct('benchmarkYield', 'Matching government yield', 7.0, { min: 0, max: 30 }),
      yrs('yearsToMaturity', 'Years to maturity', 5, { min: 0.25, max: 30 }),
      pct('recoveryRate', 'Assumed recovery rate', 40, { min: 0, max: 100 }),
      money('investment', 'Investment amount', 1000000, { min: 1 }),
    ],
    workedExample:
      'A 9.5% corporate bond against a 7.0% government yield carries a 250-basis-point spread. With a 40% recovery assumption, that spread compensates roughly 4.2% annual probability of default — the spread is not a margin of safety beyond that point.',
    limitations: [
      'The recovery assumption drives the result. Indian retail investors rarely have independent evidence of recovery rates and should not assume 40% is conservative for unsecured or subordinated debt.',
      'Spread also compensates illiquidity and risk premia, not only expected default. Some of the spread is payment for the difficulty of selling.',
    ],
    relatedCalculators: ['default-recovery', 'bond-price-yield', 'deposit-comparison'],
    engine: 'credit-spread',
  },
  {
    id: 'default-recovery',
    name: 'Expected Credit Loss',
    shortDescription:
      'Expected loss as probability of default times loss given default, and the yield required to be compensated for it.',
    category: 'fixed-income',
    difficulty: 'intermediate',
    formulas: [
      { latex: 'ECL = PD \\times LGD \\times EAD', label: 'Expected credit loss' },
      { latex: 'r_{required} = \\frac{1 + r_f}{1 - PD \\times LGD} - 1', label: 'Yield required to break even after expected loss' },
    ],
    inputs: [
      money('exposure', 'Exposure at default', 1000000, { min: 1 }),
      pct('probabilityOfDefault', 'Annual probability of default', 3, { min: 0, max: 100 }),
      pct('recoveryRate', 'Recovery rate', 40, { min: 0, max: 100 }),
      yrs('years', 'Horizon', 5, { min: 0.25, max: 30 }),
      pct('riskFreeRate', 'Benchmark risk-free rate', 7, { min: 0, max: 20 }),
    ],
    workedExample:
      'A ₹10,00,000 unsecured loan with a 3% annual default probability and 40% recovery has an expected loss of ₹18,000 in the first year. To break even against a 7% risk-free rate, the required yield is about 7.3% — a figure that looks modest only because the expected loss is spread across years with survival.',
    limitations: [
      'Expected loss is a mean. The realised loss is either a fraction of principal or nothing on each loan, so a portfolio of expected losses behaves very differently from a portfolio of realised ones.',
      'PD and recovery estimates supplied by a lender or a platform are the platform’s own assumptions and are not independently audited in most Indian retail contexts.',
    ],
    relatedCalculators: ['p2p-stress', 'credit-spread', 'p2p-diversification'],
    engine: 'default-recovery',
  },
  {
    id: 'callable-bond-price',
    name: 'Callable and Perpetual Bond Price',
    shortDescription:
      'Prices a bond to its call date and values a perpetual instrument, while stating the features that the formula cannot capture.',
    category: 'fixed-income',
    difficulty: 'expert',
    formulas: [
      { latex: 'P_{perpetual} = \\frac{C}{y}', label: 'Perpetuity: coupon divided by required yield' },
      { latex: 'YTC = \\text{yield solving } P = \\sum \\frac{C}{(1+y)^k} + \\frac{Call\\ price}{(1+y)^{n}}', label: 'Yield to call' },
    ],
    inputs: [
      money('faceValue', 'Face value', 1000000, { min: 1 }),
      pct('couponRate', 'Coupon rate', 8.5, { min: 0, max: 25 }),
      yrs('yearsToCall', 'Years to first call date', 10, { min: 0.25, max: 40 }),
      pct('yieldRequired', 'Required yield', 9, { min: 0.1, max: 40 }),
      pct('callPrice', 'Call price as % of face', 100, { min: 50, max: 120 }),
      inp('isPerpetual', 'Treat as perpetual (no maturity)', 'toggle', false),
    ],
    workedExample:
      'An 8.5% instrument callable in ten years, priced at a 9% required yield, is worth about ₹96.7 per ₹100 of face — below par, so a call is unlikely and the investor holds a below-market coupon. A perpetual instrument with the same coupon and yield prices near ₹94.4, and that price assumes coupons are never skipped.',
    limitations: [
      'The price assumes the issuer acts rationally at the call date and that coupons are never deferred. Indian AT1 instruments permit coupon skips and principal write-down, so a formula price can materially overstate what will be received.',
      'Callable bonds are negatively convex near the call date: your gain is capped precisely when rates fall, while your loss is not capped when rates rise.',
    ],
    relatedCalculators: ['bond-price-yield', 'credit-spread', 'modified-duration'],
    engine: 'callable-bond-price',
  },
  {
    id: 'interest-rate-risk',
    name: 'Interest Rate Risk',
    shortDescription:
      'The price impact of a yield shock on a bond or a bond portfolio, with and without convexity.',
    category: 'risk',
    difficulty: 'advanced',
    formulas: [
      { latex: '\\Delta P = P\\left(-D_{mod}\\Delta y + \\tfrac{1}{2}C_v (\\Delta y)^2\\right)', label: 'Price impact of a yield move' },
    ],
    inputs: [
      money('portfolioValue', 'Portfolio market value', 2500000, { min: 1 }),
      num('modifiedDuration', 'Modified duration (years)', 5.5, { min: 0, max: 30 }),
      num('convexity', 'Convexity', 40, { min: 0, max: 500 }),
      num('shockBps', 'Yield shock (basis points)', 100, { min: -500, max: 500 }),
    ],
    workedExample:
      'A ₹25,00,000 portfolio with a modified duration of 5.5 loses about ₹1,37,500 on a 100-basis-point rise in yields, reduced to roughly ₹1,32,500 once convexity is included. The same portfolio gains about ₹1,42,500 if yields fall by the same amount — the asymmetry is convexity.',
    limitations: [
      'Modified duration assumes a parallel shift in the yield curve. Real curve moves are rarely parallel, and a portfolio concentrated in one maturity behaves differently from its duration figure suggests.',
      'Credit spread changes are not yield-curve changes. A credit portfolio can lose value while government yields are flat, and duration will not capture that at all.',
    ],
    relatedCalculators: ['modified-duration', 'convexity', 'bond-ladder'],
    engine: 'interest-rate-risk',
  },
  {
    id: 'yield-on-cost',
    name: 'Yield on Cost',
    shortDescription:
      'Income yield measured against the original purchase price rather than today’s price — the metric that reveals whether income has actually grown.',
    category: 'fixed-income',
    difficulty: 'intermediate',
    formulas: [
      { latex: '\\text{Yield on cost} = \\frac{\\text{Current annual income}}{\\text{Original cost}}' },
      { latex: '\\text{Current yield} = \\frac{\\text{Current annual income}}{\\text{Current market value}}' },
    ],
    inputs: [
      money('originalCost', 'Original cost of the position', 1000000, { min: 1 }),
      money('currentValue', 'Current market value', 1800000, { min: 0 }),
      money('currentIncome', 'Income received over the last year', 90000, { min: 0 }),
    ],
    workedExample:
      'A property or bond bought for ₹10,00,000, now worth ₹18,00,000 and producing ₹90,000 a year, has a yield on cost of 9.0% and a current yield of 5.0%. Both are true; only the first describes the investor’s experience, and only the second describes what a buyer today would get.',
    limitations: [
      'Yield on cost is a backward-looking comfort metric and is frequently used to justify holding an asset that no longer offers an attractive forward return.',
      'It ignores whether the original purchase was a good decision in the first place. A high yield on a bad purchase is still a bad purchase.',
    ],
    relatedCalculators: ['dividend-return', 'reit-distribution', 'rental-yield'],
    engine: 'yield-on-cost',
  },
  {
    id: 'p2p-return',
    name: 'P2P Realised Return',
    shortDescription:
      'The return a peer-to-peer portfolio has actually produced in cash, separated from interest that has been booked but not received.',
    category: 'alternatives',
    difficulty: 'advanced',
    formulas: [
      { latex: '\\text{Reported} = \\text{interest received} + \\text{interest accrued unpaid}', label: 'What platforms usually show' },
      { latex: '\\text{Realised} = \\text{interest received} + \\text{recoveries} - \\text{fees}', label: 'Cash actually returned' },
    ],
    inputs: [
      money('totalLent', 'Total principal lent', 1000000, { min: 1 }),
      money('interestReceived', 'Interest actually received in cash', 120000),
      money('interestAccrued', 'Interest accrued but not received', 40000),
      money('feesPaid', 'Platform and servicing fees', 15000),
      money('defaultedPrincipal', 'Principal in defaulted loans', 80000),
      money('recoveries', 'Cash recovered from defaults', 15000),
      num('months', 'Months elapsed since first investment', 24, { min: 1, max: 240 }),
      pct('marginalRate', 'Your marginal tax rate', 31.2, { min: 0, max: 50 }),
    ],
    workedExample:
      '₹10,00,000 lent, with ₹1,20,000 interest received, ₹40,000 accrued, ₹80,000 in defaults and ₹15,000 recovered, has a reported return near 14.5% and a realised return closer to 10.5% before tax — and 7.2% after tax at a 31.2% marginal rate.',
    limitations: [
      'The realised figure uses cash actually received, which is the only defensible basis, but it understates returns if the outstanding loans continue to pay.',
      'Interest is taxed at slab rates in the year it is credited, whether or not it has been received. Tax on interest that later defaults is a real and common outcome.',
      'Recovery assumptions in Indian unsecured retail lending are uncertain, slow and platform-dependent.',
    ],
    relatedCalculators: ['p2p-stress', 'p2p-diversification', 'post-tax-return', 'default-recovery'],
    engine: 'p2p-return',
  },
  {
    id: 'p2p-stress',
    name: 'P2P Stress Test',
    shortDescription:
      'Scenarios in which the platform’s reported default rate is wrong, showing what happens to the realised return under each.',
    category: 'alternatives',
    difficulty: 'advanced',
    formulas: [
      { latex: '\\text{Loss} = \\text{PD}_{scenario} \\times (1 - R) \\times \\text{exposure}', label: 'Scenario credit loss' },
    ],
    inputs: [
      money('performingPrincipal', 'Performing principal outstanding', 700000, { min: 1 }),
      money('totalLent', 'Total principal ever lent', 1000000, { min: 1 }),
      money('interestReceived', 'Interest received to date', 120000),
      money('interestAccrued', 'Interest accrued but unreceived', 40000),
      pct('reportedDefaultRate', 'Platform’s reported annual default rate', 4, { min: 0, max: 50 }),
      num('horizonYears', 'Remaining weighted-average life in years', 2, { min: 0.25, max: 20 }),
    ],
    workedExample:
      'At a 4% reported default rate and 15% recovery, a ₹10,00,000 portfolio loses about ₹13,600 to defaults. If the true rate is three times as high with weak recoveries, the loss rises above ₹1,00,000 — enough to convert a 12% gross return into roughly 6%, or less.',
    limitations: [
      'The scenarios are arithmetic, not forecasts. Their purpose is to reveal how sensitive the outcome is to an assumption that the investor cannot independently verify.',
      'Recoveries in Indian unsecured retail credit arrive over years and are frequently written off. Assuming any particular recovery rate without evidence is speculation.',
    ],
    relatedCalculators: ['p2p-return', 'p2p-diversification', 'risk-of-ruin'],
    engine: 'p2p-stress',
  },
  {
    id: 'p2p-diversification',
    name: 'P2P Diversification Curve',
    shortDescription:
      'How the probability of a material portfolio loss falls as the number of independent loans rises — and where the benefit flattens.',
    category: 'alternatives',
    difficulty: 'advanced',
    formulas: [
      { latex: 'P(\\text{loss} > L) = \\sum_{k > L \\cdot n / LGD}^{n} \\binom{n}{k} p^k (1-p)^{n-k}', label: 'Binomial tail probability' },
    ],
    inputs: [
      pct('defaultProbability', 'Assumed probability of default per loan', 5, { min: 0.1, max: 60 }),
      pct('lossGivenDefault', 'Loss given default', 85, { min: 0, max: 100 }),
      pct('lossThreshold', 'Loss level treated as material', 5, { min: 0.5, max: 50 }),
      num('maxLoans', 'Largest portfolio to display', 300, { min: 10, max: 2000 }),
    ],
    workedExample:
      'With a 5% default probability and 85% loss given default, ten loans carry a substantial chance of losing more than 5% of capital. At a hundred loans the chance is small, and by three hundred it is negligible — but the total loss *rate* never falls below the expected loss of 4.25%.',
    limitations: [
      'The binomial model assumes defaults are independent. In a credit cycle they are not: defaults cluster by borrower quality, by employer, by region and by macro conditions, so the real tail is fatter than the model implies.',
      'Diversification reduces the risk of a bad outcome; it does not improve the expected return. If the expected loss exceeds the spread, more loans simply make the loss more certain.',
    ],
    relatedCalculators: ['p2p-stress', 'p2p-return', 'default-recovery'],
    engine: 'p2p-diversification',
  },
];
