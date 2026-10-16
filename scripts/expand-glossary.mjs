/**
 * Expands the glossary with terms that the series editors referenced by name
 * but which were never authored, and repairs id variants so that every
 * cross-reference in the registries resolves.
 *
 * Run: node scripts/expand-glossary.mjs
 *
 * Idempotent: existing term ids are left untouched, so manual edits to
 * published definitions are never overwritten.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(resolve(here, '..', p), 'utf8'));
const write = (p, data) => writeFileSync(resolve(here, '..', p), `${JSON.stringify(data, null, 2)}\n`, 'utf8');

const CATEGORY_IDS = [
  'investment-basics', 'equity', 'mutual-funds', 'debt', 'p2p-lending', 'gold-silver',
  'real-estate', 'reits-invits', 'derivatives', 'private-markets', 'agriculture',
  'insurance-pensions', 'international', 'digital-assets', 'taxation', 'asset-allocation',
  'portfolio-operations', 'financial-system', 'financial-mathematics', 'fraud-risk',
];

const NEW_TERMS = [
  {
    id: 'real-return',
    term: 'Real return',
    fullName: 'Inflation-adjusted return',
    category: 'financial-mathematics',
    definition:
      'The return on an investment after subtracting inflation, expressed in the purchasing power of the start date. It is computed exactly as (1 + nominal) / (1 + inflation) − 1, not as nominal minus inflation, although the difference between the two is small at Indian rates. A fixed deposit paying 7% during 6% inflation delivers a real return near 0.94%, and after tax at the 30% slab it is negative.',
    plainEnglish: 'What your money earned after accounting for rising prices. If prices rise faster than your returns, you are getting poorer while your balance grows.',
    seeAlso: ['nominal-vs-real-rate', 'fisher-equation', 'inflation'],
    sourceIds: ['rbi-home'],
  },
  {
    id: 'opportunity-cost',
    term: 'Opportunity cost',
    category: 'financial-mathematics',
    definition:
      'The value of the best alternative forgone when a choice is made. In personal finance it appears whenever money is parked: cash earning 3% while a comparable-risk instrument pays 7% has an opportunity cost of about 4% a year. Opportunity cost is a comparison rather than a cash flow, which is why the models on this site report it on its own line and never net it into a return figure.',
    plainEnglish: 'What you gave up by choosing this option instead of the next best one.',
    seeAlso: ['net-present-value', 'discount-factor', 'risk-return-tradeoff'],
    sourceIds: [],
  },
  {
    id: 'risk-premium',
    term: 'Risk premium',
    category: 'financial-mathematics',
    definition:
      'The extra expected return that investors demand for holding a risky asset instead of a risk-free one. It is an expectation, not a payment: realised premia vary enormously by decade, and long periods with negative equity risk premia are documented in many markets. A premium that is negative in a particular period is not evidence that risk disappeared, only that the price paid for it was too high.',
    plainEnglish: 'The extra return you hope to earn for accepting the chance of losing money.',
    seeAlso: ['risk-return-tradeoff', 'sharpe-ratio', 'expected-shortfall'],
    sourceIds: ['rbi-handbook-statistics'],
  },
  {
    id: 'illiquidity-premium',
    term: 'Illiquidity premium',
    category: 'private-markets',
    definition:
      'The additional return theoretically available to investors who accept the inability to sell an asset quickly, as in private equity, unlisted shares and real estate. The premium is compensation for a real constraint — capital can be locked for years and the exit price is uncertain — but part of any observed premium in unlisted assets is an artefact of stale or optimistic valuations rather than genuine excess return.',
    plainEnglish: 'Extra return offered in exchange for not being able to get your money out when you want.',
    seeAlso: ['liquidity-premium', 'private-equity', 'aif'],
    sourceIds: ['sebi-aif'],
  },
  {
    id: 'tail-risk',
    term: 'Tail risk',
    category: 'financial-mathematics',
    definition:
      'The risk of outcomes far into the distribution of returns, beyond what a normal distribution would predict. Indian equity markets have produced single-day falls larger than five standard deviations, events that Gaussian models label as once-in-many-millennia. Tail risk is the reason leverage is dangerous even when volatility looks modest, and why probability-weighted averages understate what can happen.',
    plainEnglish: 'The chance of a rare, very bad outcome that normal statistics make seem impossible.',
    seeAlso: ['value-at-risk', 'expected-shortfall', 'maximum-drawdown'],
    sourceIds: [],
  },
  {
    id: 'leverage',
    term: 'Leverage',
    category: 'investment-basics',
    definition:
      'Using borrowed money to increase the size of a position relative to the capital committed. Leverage multiplies gains and losses symmetrically and adds a second failure mode: the lender can force liquidation at the worst moment, converting a temporary drawdown into a permanent loss. In Indian retail markets leverage appears through futures margins, margin trading facility, loan-against-securities and property mortgages.',
    plainEnglish: 'Investing with borrowed money. It magnifies both the profit and the loss, and it gives someone else the power to close your position.',
    seeAlso: ['loan-to-value', 'span-margin', 'risk-return-tradeoff'],
    sourceIds: ['nse-derivatives-cm'],
  },
  {
    id: 'return-on-capital',
    term: 'Return on capital',
    category: 'equity',
    definition:
      'A family of measures of how much profit a business generates per rupee of capital employed, most commonly return on capital employed (EBIT divided by capital employed) and return on invested capital (after-tax operating profit divided by debt plus equity). High and sustained return on capital is the clearest evidence of a durable competitive advantage, because it shows the business earns more on incremental capital than it costs.',
    plainEnglish: 'How much profit a company earns for every rupee investors have put into it.',
    seeAlso: ['roce', 'roe', 'ev-ebitda'],
    sourceIds: [],
  },
  {
    id: 'crar',
    term: 'Capital to risk-weighted assets ratio',
    fullName: 'CRAR / Capital adequacy ratio',
    category: 'financial-system',
    definition:
      'A bank’s capital expressed as a percentage of its risk-weighted assets. The RBI requires scheduled commercial banks to maintain a minimum CRAR of 9%, above the 8% Basel III international floor, with additional buffers for systemically important banks. The ratio measures a bank’s ability to absorb losses before depositors are exposed, although it relies on the bank’s own risk weights, which is why the regulator also runs periodic asset-quality reviews.',
    plainEnglish: 'A cushion of the bank’s own money against the loans it has made. The bigger the cushion, the safer the deposits.',
    seeAlso: ['deposit-insurance', 'rbi', 'crr'],
    sourceIds: ['rbi-dbie', 'bis-home'],
  },
  {
    id: 'investor-protection-fund',
    term: 'Investor protection fund',
    category: 'financial-system',
    definition:
      'A fund maintained by Indian stock exchanges and depositories, financed by a share of transaction charges and unclaimed benefits, that compensates investors in limited circumstances such as broker default verified by the exchange. Coverage is capped per investor per default, and it does not protect against market losses, fraud in an unregistered scheme, or a broker’s advisory failures. The funds are a backstop of last resort, not insurance.',
    plainEnglish: 'A pool of money that can partly compensate investors if their registered broker defaults — not a guarantee against losing money in the market.',
    seeAlso: ['sebi', 'nse', 'bse'],
    sourceIds: ['sebi-investor-education'],
  },
  {
    id: 'ombudsman',
    term: 'Ombudsman',
    category: 'financial-system',
    definition:
      'A free grievance-redress mechanism operated by each financial regulator: the RBI’s Integrated Ombudsman Scheme for banks and non-banking lenders, SEBI SCORES for securities markets, the Insurance Ombudsman under IRDAI, and the PFRDA for pension complaints. Complaints must first be made to the regulated entity, and a decision is typically expected within 30 days before the ombudsman route opens. Awards are binding on the regulated entity up to a statutory limit.',
    plainEnglish: 'An official complaints service that can order a bank, insurer or broker to make things right without going to court.',
    seeAlso: ['rbi', 'sebi', 'irdai'],
    sourceIds: ['rbi-home', 'sebi-investor-education'],
  },
  {
    id: 'nclt',
    term: 'National Company Law Tribunal',
    fullName: 'NCLT',
    category: 'financial-system',
    definition:
      'The tribunal that hears company law matters and corporate insolvency proceedings under the Insolvency and Bankruptcy Code, 2016. Creditor-triggered insolvency resolution begins with a petition to the NCLT, which appoints a resolution professional, imposes a moratorium on debt recovery, and oversees the process that ends in a resolution plan or liquidation. For a lender or bondholder, NCLT proceedings are where recovery is determined.',
    plainEnglish: 'The court that handles company collapses and decides who gets paid what when a business fails.',
    seeAlso: ['insolvency', 'debenture', 'ncd'],
    sourceIds: ['ibbi-home', 'nclt-judgments'],
  },
  {
    id: 'insolvency',
    term: 'Insolvency',
    category: 'financial-system',
    definition:
      'The state of being unable to pay debts as they fall due. Under the Insolvency and Bankruptcy Code, 2016, financial creditors can trigger resolution through the NCLT, the management is displaced by a resolution professional, and creditors vote on a resolution plan. Recovery rates in Indian insolvency proceedings have varied widely by sector and vintage, and the realised recovery for unsecured creditors including retail bondholders has often been low.',
    plainEnglish: 'When a borrower cannot repay and the formal legal process decides what creditors recover.',
    seeAlso: ['nclt', 'default', 'recovery-rate'],
    sourceIds: ['ibbi-home'],
  },
  {
    id: 'transmission',
    term: 'Monetary policy transmission',
    category: 'financial-system',
    definition:
      'The process by which a change in the RBI’s policy repo rate flows through to the rates that households actually face: lending rates, deposit rates and bond yields. Transmission is uneven and slow: deposit rates in India have historically adjusted downward faster than they rise, and the spread between the repo rate and bank deposit rates varies with liquidity conditions. An investor holding fixed-rate deposits is exposed to the timing of this process.',
    plainEnglish: 'How long it takes, and how completely, a change in RBI’s rate shows up in the interest on your loans and deposits.',
    seeAlso: ['repo-rate', 'monetary-policy', 'reinvestment-risk'],
    sourceIds: ['rbi-home'],
  },
  {
    id: 'drift',
    term: 'Allocation drift',
    category: 'portfolio-operations',
    definition:
      'The gap that develops between a portfolio’s actual asset weights and its target weights as components grow at different rates. A 60:40 portfolio after a strong equity run may be 70:30, which silently raises its risk profile. Drift is controlled by rebalancing bands, by direction of new contributions into underweight sleeves, or deliberately allowed within policy limits.',
    plainEnglish: 'How far your portfolio has wandered from the mix you chose.',
    seeAlso: ['rebalancing', 'strategic-asset-allocation', 'asset-allocation'],
    sourceIds: [],
  },
  {
    id: 'investment-policy-statement',
    term: 'Investment policy statement',
    fullName: 'IPS',
    category: 'portfolio-operations',
    definition:
      'A written document that states a portfolio’s objectives, target allocation, permissible asset classes, rebalancing rules, liquidity needs and review process. Its main value is behavioural: it is written when the investor is calm so that it can be followed when they are not. Institutional investors have used policy statements for decades; for individuals they are the difference between a plan and a series of reactions to news.',
    plainEnglish: 'A written rulebook for your money, made in advance, so decisions are not made in a panic.',
    seeAlso: ['asset-allocation', 'risk-tolerance', 'rebalancing'],
    sourceIds: [],
  },
  {
    id: 'liquidity-coverage',
    term: 'Liquidity coverage',
    category: 'portfolio-operations',
    definition:
      'The number of months of required outflows that can be met from assets convertible to cash immediately, without selling long-horizon assets at a loss. The metric deliberately counts only genuinely same-day assets such as deposits and liquid funds, and treats equity, property and alternative assets as unavailable for emergencies because their worst moments coincide with when cash is needed.',
    plainEnglish: 'How many months you could keep paying the bills using only money you can access today.',
    seeAlso: ['emergency-fund', 'liquidity', 'asset-allocation'],
    sourceIds: [],
  },
  {
    id: 'troy-ounce',
    term: 'Troy ounce',
    category: 'gold-silver',
    definition:
      'The unit of mass used in international precious-metal markets, equal to 31.1034768 grams, slightly heavier than the everyday ounce of 28.35 grams. London spot prices quoted in US dollars per troy ounce are what Indian traders convert to rupees per 10 grams, the domestic convention. Confusing the two ounces misprices gold by about 9.7%, which is why the distinction matters even though the difference looks trivial.',
    plainEnglish: 'The internationally standard measure of gold weight — 31.1 grams, not the 28.35-gram ounce used for other goods.',
    seeAlso: ['gold-etf', 'physical-gold', 'import-duty-bullion'],
    sourceIds: ['nsdl-sgb'],
  },
  {
    id: 'occupancy-certificate',
    term: 'Occupancy certificate',
    fullName: 'OC',
    category: 'real-estate',
    definition:
      'A certificate issued by the local planning authority confirming that a completed building has been constructed in accordance with approved plans and is fit for occupation. Possession offered without an occupancy certificate exposes the buyer to property-tax penalties, difficulty obtaining utilities and legal risk in resale. RERA makes the promoter responsible for obtaining it, and courts have repeatedly held that handing over possession without it is a deficiency in service.',
    plainEnglish: 'Local-government sign-off that a building is legally finished and safe to live in. Buying without it is buying a problem.',
    seeAlso: ['rera', 'redevelopment', 'stamp-duty'],
    sourceIds: ['mospi-home', 'consumer-protection-2019'],
  },
  {
    id: 'sm-reit',
    term: 'Small and medium REIT',
    fullName: 'SM REIT',
    category: 'reits-invits',
    definition:
      'A REIT structure created by SEBI in 2024 for portfolios between ₹50 crore and ₹500 crore of real estate assets, designed to bring fractional ownership platforms inside the regulatory perimeter. SM REITs list units on exchanges, must distribute most of their net distributable cash flows, and are overseen by a trustee like a full REIT, but they hold fewer, smaller assets and their units are far less liquid.',
    plainEnglish: 'A smaller version of a listed REIT, created so platforms selling shares of buildings have to follow real rules.',
    seeAlso: ['reit', 'invit', 'reit-trustee'],
    sourceIds: ['sebi-sm-reit-2024'],
  },
  {
    id: 'capital-call',
    term: 'Capital call',
    category: 'private-markets',
    definition:
      'A demand from a private fund to its investors for part of the capital they previously committed but did not pay in at the start. Funds draw capital over several years as they find investments, so a commitment of ₹10 lakh may be called in tranches of ₹1–2 lakh over three or four years. Investors must keep the entire uncalled commitment available; failing to meet a call leads to penalties and forfeiture of fund interests.',
    plainEnglish: 'When a private fund asks for the money you promised, a slice at a time.',
    seeAlso: ['private-equity', 'j-curve', 'aif'],
    sourceIds: ['sebi-aif'],
  },
  {
    id: 'dpi',
    term: 'Distributions to paid-in capital',
    fullName: 'DPI',
    category: 'private-markets',
    definition:
      'A private-fund metric equal to the cash already distributed to investors divided by their paid-in capital. Unlike IRR or TVPI it counts only money actually returned, not paper valuations, which is why practitioners treat it as the most honest of the standard metrics. A fund reporting a high IRR with a DPI of 0.2 has returned ₹20 for every ₹100 invested — the rest is an estimate.',
    plainEnglish: 'How much cash a private fund has actually given back for every ₹100 you put in.',
    seeAlso: ['tvpi', 'irr', 'j-curve'],
    sourceIds: ['sebi-aif'],
  },
  {
    id: 'tvpi',
    term: 'Total value to paid-in capital',
    fullName: 'TVPI',
    category: 'private-markets',
    definition:
      'A private-fund metric equal to distributed cash plus the estimated value of the remaining portfolio, divided by paid-in capital. Because the numerator includes unrealised holdings valued by the fund manager, TVPI is only as reliable as the valuation policy: a fund nearing its end holding an underperforming company at its last funding-round price reports a flattering TVPI that a sale would not confirm.',
    plainEnglish: 'Cash returned plus what the fund manager says the remaining investments are worth, per rupee invested.',
    seeAlso: ['dpi', 'nav', 'private-equity'],
    sourceIds: ['sebi-aif'],
  },
  {
    id: 'spv',
    term: 'Special purpose vehicle',
    fullName: 'SPV',
    category: 'private-markets',
    definition:
      'A separate legal entity created to hold a specific asset or undertaking, insulating it from the sponsor’s other obligations. In Indian asset management, AIFs and other pooled vehicles invest into portfolio companies through SPVs, and in infrastructure and real estate, projects sit in SPVs whose cash flows back specific debt. When evaluating such an investment, the SPV’s standalone obligations — not the sponsor’s reputation — determine what the investor can recover.',
    plainEnglish: 'A company set up to hold one particular asset, so its risks are ring-fenced.',
    seeAlso: ['aif', 'reit', 'securitisation'],
    sourceIds: ['sebi-aif'],
  },
  {
    id: 'power-law-returns',
    term: 'Power-law returns',
    category: 'private-markets',
    definition:
      'The observed pattern in venture capital that a small number of investments produce most of a fund’s return, with the majority failing or returning little. Because the distribution is so skewed, a portfolio of one or two venture investments has a low probability of containing a winner, and the median venture fund underperforms public equity while the mean is driven by a few spectacular funds.',
    plainEnglish: 'In venture investing, almost all the return comes from one or two winners while most bets go to zero.',
    seeAlso: ['venture-capital', 'vc-fund', 'illiquidity-premium'],
    sourceIds: ['sebi-aif'],
  },
  {
    id: 'nps-tier-ii',
    term: 'NPS Tier II account',
    category: 'insurance-pensions',
    definition:
      'A voluntary, withdrawable account under the National Pension System that sits alongside the locked-in Tier I account and offers the same investment choices under the same regulated managers. Withdrawals are permitted at will, and the account carries no exclusive tax deduction for most investors, so its main uses are disciplined saving in named schemes and parking contributions beyond the Tier I deduction ceiling.',
    plainEnglish: 'A flexible companion account to NPS that lets you take your money out whenever you want, without the Tier I tax breaks or lock-in.',
    seeAlso: ['nps', 'pfrda', 'annuity'],
    sourceIds: ['pfrda-home'],
  },
  {
    id: 'schedule-fa',
    term: 'Schedule FA',
    category: 'international',
    definition:
      'The schedule in the Indian income-tax return in which a resident declares foreign assets — bank accounts, custodial holdings, foreign equity, immovable property and trusts — held at any time during the year, with details of income earned and the nature of the holding. Non-disclosure carries severe consequences under the Black Money (Undisclosed Foreign Income and Assets) Act, 2015, including penalties of three times the tax on the undisclosed income and prosecution.',
    plainEnglish: 'The form where Indian residents must list every foreign account and asset in their tax return.',
    seeAlso: ['lrs', 'fema', 'foreign-tax-credit'],
    sourceIds: ['itd-efiling-ay2026-27', 'income-tax-act-1961'],
  },
  {
    id: 'currency-hedging',
    term: 'Currency hedging',
    category: 'international',
    definition:
      'Neutralising the effect of exchange-rate movements on a foreign-currency investment, typically by selling the foreign currency forward. The cost of the hedge is the interest-rate differential between the two currencies, so hedging a dollar investment from rupees removes the depreciation benefit but also the appreciation risk; the choice depends on whether currency exposure is a deliberate part of the investment thesis.',
    plainEnglish: 'Paying to remove the currency gamble from a foreign investment, leaving only the investment itself.',
    seeAlso: ['currency-hedged-fund', 'currency-risk', 'international-mutual-fund'],
    sourceIds: ['rbi-fema-lrs'],
  },
  {
    id: 'virtual-digital-asset',
    term: 'Virtual digital asset',
    fullName: 'VDA',
    category: 'digital-assets',
    definition:
      'The statutory category created by the Finance Act, 2022, covering cryptoassets and non-fungible tokens along with any token generated through cryptographic means, excluding gift cards, vouchers, loyalty points and central-bank digital currency. Income from transferring a VDA is taxed at a flat 30% under s.115BBH with no deduction for expenses other than cost of acquisition, and losses cannot be set off against any income.',
    plainEnglish: 'The tax law’s umbrella term for cryptocurrencies and NFTs, which are taxed at a flat 30% with no loss relief.',
    seeAlso: ['vda-taxation', 'cryptocurrency', 'nft'],
    sourceIds: ['income-tax-act-1961', 'itd-efiling-ay2026-27'],
  },
  {
    id: 'private-key',
    term: 'Private key',
    category: 'digital-assets',
    definition:
      'The cryptographic secret that proves ownership of a blockchain address and authorises transfers from it. Whoever holds the private key controls the assets; no exchange, custodian or court can recover them if the key is lost, and no one can reverse a transfer made with a compromised key. This is why the phrase “not your keys, not your coins” exists, and also why self-custody makes theft by phishing irreversible.',
    plainEnglish: 'The password that controls cryptoassets. Lose it and the money is gone; leak it and it can be taken instantly.',
    seeAlso: ['crypto-wallet', 'self-custody', 'blockchain'],
    sourceIds: ['rbi-home'],
  },
  {
    id: 'self-custody',
    term: 'Self-custody',
    category: 'digital-assets',
    definition:
      'Holding digital assets under keys controlled by the investor rather than by an exchange or custodian. It removes counterparty risk — the failure of an exchange cannot take the assets — and introduces operational risk instead: lost keys, compromised devices, phishing and the complete absence of recovery. There is no depositor-protection framework, no ombudsman and no reversal in self-custody, unlike every regulated Indian financial account.',
    plainEnglish: 'Being your own bank in crypto: no one can freeze your funds, and no one can help you if you make a mistake.',
    seeAlso: ['private-key', 'crypto-wallet', 'identity-theft'],
    sourceIds: [],
  },
  {
    id: 'tokenisation',
    term: 'Tokenisation',
    category: 'digital-assets',
    definition:
      'Representing an asset — a bond, a fund unit, an invoice, a property claim — as a blockchain token that can be transferred and split. In India, tokenisation of securities falls within SEBI’s perimeter when offered to the public, and the RBI has studied tokenised deposits and central-bank digital currency separately. Outside regulated venues, most tokenised offerings are structured to argue they fall outside Indian securities law, an argument that may or may not survive enforcement.',
    plainEnglish: 'Turning something like a bond or building into tradeable digital tokens, often to sell small pieces.',
    seeAlso: ['blockchain', 'cbdc', 'stablecoin'],
    sourceIds: ['rbi-home', 'sebi-home'],
  },
  {
    id: 'proof-of-stake',
    term: 'Proof of stake',
    category: 'digital-assets',
    definition:
      'A blockchain consensus mechanism in which validators lock (“stake”) their own tokens as collateral and are rewarded for correctly validating transactions, with the stake forfeited for misconduct. It replaces the energy-intensive mining of proof-of-work with a system whose security depends on the value of the staked tokens, which cuts both ways: the mechanism is as strong as the market price of the asset it secures.',
    plainEnglish: 'A way blockchains agree on transactions by making validators put up their own coins as a guarantee.',
    seeAlso: ['blockchain', 'bitcoin', 'cryptocurrency'],
    sourceIds: [],
  },
  {
    id: 'money-multiplier',
    term: 'Money multiplier scheme',
    category: 'fraud-risk',
    definition:
      'A fraud structure that promises to multiply money within days, usually through a “trading program” or “matrix” in which participants pay to enter and are paid from the entry fees of later participants. The promised mechanism is fictional and the arithmetic is that of a chain letter: it collapses when new deposits stop. Several such schemes have been prosecuted in India as unauthorised collective investment schemes and money circulation schemes.',
    plainEnglish: 'A scam that promises to double your money in days but actually pays old members with new members’ money.',
    seeAlso: ['ponzi-scheme', 'unauthorised-collective-investment-scheme', 'guaranteed-returns-scam'],
    sourceIds: ['sebi-unsolicited-tips', 'bns-2023'],
  },
  {
    id: 'economic-offences-wing',
    term: 'Economic Offences Wing',
    fullName: 'EOW',
    category: 'fraud-risk',
    definition:
      'Specialised units within Indian state police forces that investigate economic crimes including investment fraud, cheating and criminal breach of trust. Cases under the Banning of Unregulated Deposit Schemes Act and the Prize Chits and Money Circulation Schemes (Banning) Act are typically registered with the EOW, and complaints there run parallel to, or instead of, proceedings before SEBI, the RBI or a consumer forum.',
    plainEnglish: 'The police unit that investigates financial crimes in each state.',
    seeAlso: ['cyber-fraud', 'ponzi-scheme', 'phishing'],
    sourceIds: ['bns-2023', 'sebi-enforcement-orders'],
  },
  {
    id: 'agroforestry',
    term: 'Agroforestry',
    category: 'agriculture',
    definition:
      'Growing trees alongside crops or livestock on the same land, which Indian agricultural policy promotes for soil health, water retention and supplementary income from timber and fruit. As an investment it appears through lease-and-plant models and “tree farming” schemes that promise fixed returns, many of which have collapsed — the biological timeline is long, the market for harvested timber is local and illiquid, and the promoter, not the investor, usually controls both the land and the sale.',
    plainEnglish: 'Combining trees and crops on one farm. Real in agriculture; frequently abused as a fixed-return scam.',
    seeAlso: ['contract-farming', 'land-ceiling', 'minimum-support-price'],
    sourceIds: ['icar-agri-economics', 'fao-fra'],
  },
  {
    id: 'land-ceiling',
    term: 'Land ceiling',
    category: 'agriculture',
    definition:
      'Statutory limits on the amount of agricultural land a person or family may own, enacted by most Indian states in the post-independence decades to redistribute land. Ceilings, exemptions and enforcement differ by state and have been amended repeatedly; land in excess could be surrendered to the state and redistributed. The laws matter to investors in agricultural land because they constrain how much may be held and how titles can be structured.',
    plainEnglish: 'State laws that cap how much agricultural land one owner may hold.',
    seeAlso: ['tenancy-law', 'minimum-support-price', 'e-nam'],
    sourceIds: ['icar-agri-economics'],
  },
  {
    id: 'tenancy-law',
    term: 'Agricultural tenancy law',
    category: 'agriculture',
    definition:
      'State-level legislation governing the leasing of agricultural land, including rent-fixation, security of tenure and resumption by owners. Several states restrict or regulate informal leasing, and a draft Model Land Leasing Act circulated in 2016 proposed legalising and documenting leases to encourage investment, but adoption has been uneven. For an investor considering agricultural land, whether it can be legally leased and cultivated by someone else is a threshold question.',
    plainEnglish: 'State rules on renting out farmland — who may lease, for how long, and on what terms.',
    seeAlso: ['land-ceiling', 'contract-farming', 'agroforestry'],
    sourceIds: ['icar-agri-economics'],
  },
];

/* ------------------------------------------------------------------ remaps */

/** Series bibliography id that was written with the wrong prefix. */
const SOURCE_REMAP = {
  'itr-efiling-ay2026-27': 'itd-efiling-ay2026-27',
};

/** Glossary ids referenced under working names, mapped to the authored term. */
const TERM_REMAP = {
  'compound-interest': 'compounding',
  'internal-rate-of-return': 'irr',
  'price-to-earnings': 'pe-ratio',
  'return-on-equity': 'roe',
  'return-on-capital-employed': 'roce',
  'return-on-capital': 'roce',
  'earnings-per-share': 'eps',
  ter: 'total-expense-ratio',
  'portfolio-turnover': 'portfolio-turnover-ratio',
  coupon: 'coupon-rate',
  'default-probability': 'probability-of-default',
  'capital-gains-tax-loss-harvesting': 'tax-loss-harvesting',
  'set-off': 'set-off-and-carry-forward',
  'carry-forward': 'set-off-and-carry-forward',
  cess: 'health-and-education-cess',
  'days-past-due': 'dpd',
  'sovereign-gold-bond': 'sovereign-gold-bond-scheme',
  'import-duty': 'import-duty-bullion',
  'distribution-per-unit': 'dpu',
  manager: 'reit-manager',
  'futures-contract': 'futures',
  'vintage-year': 'vintage',
  'endowment-policy': 'endowment-plan',
  'mortality-charges': 'mortality-charge',
  'crop-insurance': 'pradhan-mantri-fasal-bima-yojana',
  'collective-investment-scheme': 'unauthorised-collective-investment-scheme',
  'unauthorised-scheme': 'unauthorised-collective-investment-scheme',
  jem: 'redevelopment',
  'nav-reit': 'nav',
};

/* ---------------------------------------------------------------- execute */

const glossary = read('src/data/glossary/terms.json');
const series = read('src/data/series/series.json');
const library = read('src/data/library/items.json');
const sources = read('src/data/sources/registry.json');
const sourceIds = new Set(sources.map((s) => s.id));

const existing = new Set(glossary.map((t) => t.id));
let added = 0;
for (const term of NEW_TERMS) {
  if (existing.has(term.id)) continue;
  if (!CATEGORY_IDS.includes(term.category)) throw new Error(`${term.id}: bad category ${term.category}`);
  if (!term.definition || term.definition.length < 60) throw new Error(`${term.id}: definition too short`);
  for (const sid of term.sourceIds) {
    if (!sourceIds.has(sid)) throw new Error(`${term.id}: unknown source ${sid}`);
  }
  glossary.push(term);
  existing.add(term.id);
  added += 1;
}

// Cross-links may only reference terms that now exist.
for (const term of glossary) {
  for (const link of term.seeAlso ?? []) {
    if (!existing.has(link)) throw new Error(`${term.id}: seeAlso -> unknown term ${link}`);
  }
}

let remapped = 0;
for (const entry of series) {
  if (Array.isArray(entry.glossaryTerms)) {
    const next = [...new Set(entry.glossaryTerms.map((t) => TERM_REMAP[t] ?? t))];
    remapped += entry.glossaryTerms.length - next.length;
    entry.glossaryTerms = next;
  }
  if (Array.isArray(entry.bibliography)) {
    entry.bibliography = [...new Set(entry.bibliography.map((s) => SOURCE_REMAP[s] ?? s))];
  }
}

// The library's foundational books belong to the foundational series.
let libraryFixed = 0;
for (const item of library) {
  if (!Array.isArray(item.seriesIds)) continue;
  const next = item.seriesIds.map((s) => (s === 'investment-basics' ? 'science-of-returns' : s));
  if (next.join() !== item.seriesIds.join()) libraryFixed += 1;
  item.seriesIds = [...new Set(next)];
}

// Final validation: nothing may remain unresolved.
const unresolved = [];
for (const entry of series) {
  for (const term of entry.glossaryTerms ?? []) {
    if (!existing.has(term)) unresolved.push(`${entry.id} -> term ${term}`);
  }
  for (const sid of entry.bibliography ?? []) {
    if (!sourceIds.has(sid)) unresolved.push(`${entry.id} -> source ${sid}`);
  }
}
const seriesIds = new Set(series.map((s) => s.id));
for (const item of library) {
  for (const sid of item.seriesIds ?? []) {
    if (!seriesIds.has(sid)) unresolved.push(`${item.id} -> series ${sid}`);
  }
}
if (unresolved.length > 0) {
  console.error('Unresolved cross-references remain:');
  for (const line of unresolved) console.error(`  - ${line}`);
  process.exit(1);
}

write('src/data/glossary/terms.json', glossary);
write('src/data/series/series.json', series);
write('src/data/library/items.json', library);

console.log(`Added ${added} glossary terms (total ${glossary.length}).`);
console.log(`Remapped ${remapped} duplicate series glossary references; fixed ${libraryFixed} library entries.`);
console.log('All series and library cross-references resolve.');
