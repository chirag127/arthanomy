/**
 * Site identity, navigation architecture and investment taxonomy.
 *
 * The taxonomy below is the canonical spelling of Arthanomy's investment
 * universe. Content schemas, navigation, filtering, the comparison engine and
 * the roadmap all reference these ids. It is deliberately extensible: add an
 * entry here, then add content under the matching category id.
 */

export const site = {
  name: 'Arthanomy',
  wordmark: 'ARTHANOMY',
  tagline: 'The Science of Wealth. The Reality of Risk.',
  parentBrand: 'Arthanomy',
  description:
    'A source-driven Indian investment, taxation and wealth intelligence library. Understand every asset, quantify every risk, and see what you actually keep after taxes, fees and inflation.',
  url: 'https://chirag127.github.io',
  basePath: '/arthanomy',
  locale: 'en-IN',
  author: {
    name: 'Chirag Singhal',
    email: 'chirag@oriz.in',
    facebook: 'https://www.facebook.com/singhal127',
    support: 'https://buymeacoffee.com/chirag127',
  },
  license: {
    code: 'MIT',
    content: 'CC BY-NC-SA 4.0 for original editorial content',
  },
} as const;

export const disclaimer = {
  short:
    'Arthanomy is independent educational research, not investment, tax, legal or accounting advice.',
  long: 'Nothing on this website is an offer, solicitation or recommendation to buy or sell any security or financial product. The author is not a registered investment adviser. Figures shown are research estimates or clearly-labelled illustrative models — past results never guarantee future outcomes. Verify every tax and regulatory claim against the primary source cited before acting.',
} as const;

/* -------------------------------------------------------------------------
   Categories — the 20 domains of the investment universe
   ------------------------------------------------------------------------- */
export interface CategoryMeta {
  id: string;
  name: string;
  shortName: string;
  blurb: string;
  /** lucide-react icon name */
  icon: string;
  /** tailwind-ish accent token used for section marks */
  accent: 'brass' | 'teal' | 'ink' | 'gain' | 'loss' | 'caution';
}

export const categories: CategoryMeta[] = [
  {
    id: 'investment-basics',
    name: 'Investment Foundations',
    shortName: 'Foundations',
    blurb:
      'How money, credit, interest rates, risk premiums and capital markets actually work — the substrate every other asset class sits on.',
    icon: 'Compass',
    accent: 'ink',
  },
  {
    id: 'equity',
    name: 'Equity & Public Markets',
    shortName: 'Equity',
    blurb:
      'Listed shares, market-cap tiers, factor strategies, unlisted and pre-IPO equity, ESOPs, buybacks, corporate actions and forensic accounting.',
    icon: 'TrendingUp',
    accent: 'teal',
  },
  {
    id: 'mutual-funds',
    name: 'Mutual Funds & Collective Investments',
    shortName: 'Mutual Funds',
    blurb:
      'Every SEBI scheme category from overnight funds to thematic equity, with tracking error, expense drag, direct-versus-regular and portfolio restrictions.',
    icon: 'Layers',
    accent: 'ink',
  },
  {
    id: 'debt',
    name: 'Debt, Credit & Fixed Income',
    shortName: 'Debt',
    blurb:
      'Deposits, G-secs, corporate bonds, NCDs, securitised debt, private credit and distressed debt — with full bond mathematics.',
    icon: 'Landmark',
    accent: 'brass',
  },
  {
    id: 'p2p-lending',
    name: 'P2P Lending & Alternative Credit',
    shortName: 'P2P Lending',
    blurb:
      'RBI-regulated NBFC-P2P platforms, underwriting, vintage analysis, default and recovery mechanics, cash-flow IRR and platform failure risk.',
    icon: 'HandCoins',
    accent: 'caution',
  },
  {
    id: 'gold-silver',
    name: 'Gold, Silver & Commodities',
    shortName: 'Gold & Silver',
    blurb:
      'Physical metal, ETFs, fund-of-funds, Sovereign Gold Bonds and their secondary market, digital gold, futures and commodity exposure.',
    icon: 'Coins',
    accent: 'brass',
  },
  {
    id: 'real-estate',
    name: 'Real Estate & Private Property',
    shortName: 'Real Estate',
    blurb:
      'Residential and commercial property economics, complete cost of ownership, leverage, joint development, fractional ownership and distressed property.',
    icon: 'Building2',
    accent: 'ink',
  },
  {
    id: 'reits-invits',
    name: 'REITs, InvITs & Yield Vehicles',
    shortName: 'REITs & InvITs',
    blurb:
      'Regulated Indian REITs, InvITs and small-and-medium REITs — distribution mechanics, NAV versus market price, and structural risk.',
    icon: 'Network',
    accent: 'brass',
  },
  {
    id: 'derivatives',
    name: 'Derivatives & Advanced Trading',
    shortName: 'Derivatives',
    blurb:
      'Futures, options, the Greeks, volatility structure, margin mechanics, payoff construction and the arithmetic of why most option buyers lose.',
    icon: 'Activity',
    accent: 'loss',
  },
  {
    id: 'private-markets',
    name: 'Private Markets & Business Ownership',
    shortName: 'Private Markets',
    blurb:
      'Angel and venture capital, private equity and credit, AIF structures, search funds, SME acquisitions and operating businesses.',
    icon: 'Rocket',
    accent: 'caution',
  },
  {
    id: 'agriculture',
    name: 'Agriculture, Forestry & Natural Assets',
    shortName: 'Agriculture',
    blurb:
      'Farmland, horticulture, agroforestry, timber, dairy, aquaculture and carbon-linked assets — with biological cycles and land-tenure law.',
    icon: 'Sprout',
    accent: 'gain',
  },
  {
    id: 'insurance-pensions',
    name: 'Insurance, Pensions & Government Schemes',
    shortName: 'Pensions & Schemes',
    blurb:
      'PPF, EPF, NPS, SSY, post-office schemes, annuities, ULIPs and endowment policies — separated into savings, insurance and risk transfer.',
    icon: 'ShieldCheck',
    accent: 'ink',
  },
  {
    id: 'international',
    name: 'International & Currency Exposure',
    shortName: 'International',
    blurb:
      'Overseas funds and equities, LRS and FEMA mechanics, TCS, foreign-asset taxation, tax residency and double-tax relief.',
    icon: 'Globe2',
    accent: 'teal',
  },
  {
    id: 'digital-assets',
    name: 'Digital Assets & Emerging Opportunities',
    shortName: 'Digital Assets',
    blurb:
      'Crypto assets, tokenised instruments, DeFi mechanics, data centres, energy transition and AI infrastructure — appraised critically.',
    icon: 'Blocks',
    accent: 'loss',
  },
  {
    id: 'taxation',
    name: 'Investment Taxation',
    shortName: 'Taxation',
    blurb:
      'A versioned registry of tax rules by asset class and income type, with holding periods, set-off, TDS/TCS, surcharge, cess and worked examples.',
    icon: 'Receipt',
    accent: 'brass',
  },
  {
    id: 'asset-allocation',
    name: 'Asset Allocation & Portfolio Construction',
    shortName: 'Allocation',
    blurb:
      'Portfolio models by objective, covariance and correlation reality checks, rebalancing, stress tests and Monte Carlo limitations.',
    icon: 'PieChart',
    accent: 'teal',
  },
  {
    id: 'portfolio-operations',
    name: 'Operating a Portfolio',
    shortName: 'Operations',
    blurb:
      'Investment policy statements, account structures, recordkeeping, rebalancing, withdrawals, tax-loss harvesting and succession.',
    icon: 'ClipboardList',
    accent: 'ink',
  },
  {
    id: 'financial-system',
    name: 'The Indian Financial System',
    shortName: 'Financial System',
    blurb:
      'RBI, SEBI, IRDAI, PFRDA, exchanges, depositories, clearing corporations, mutual fund plumbing, insurance and the bond market.',
    icon: 'Building',
    accent: 'ink',
  },
  {
    id: 'financial-mathematics',
    name: 'Financial Mathematics & Quantitative Methods',
    shortName: 'Mathematics',
    blurb:
      'CAGR, XIRR, duration, convexity, credit modelling, portfolio optimisation, backtesting bias and Monte Carlo — worked from first principles.',
    icon: 'Sigma',
    accent: 'teal',
  },
  {
    id: 'fraud-risk',
    name: 'Financial Fraud & Investor Protection',
    shortName: 'Fraud & Integrity',
    blurb:
      'How Ponzi schemes, market manipulation and mis-selling actually operate, the red flags that precede them, and the legal remedies available.',
    icon: 'ShieldAlert',
    accent: 'loss',
  },
];

export const categoryById = new Map(categories.map((c) => [c.id, c]));

export function categoryMeta(id: string): CategoryMeta {
  const meta = categoryById.get(id);
  if (!meta) {
    return {
      id,
      name: id,
      shortName: id,
      blurb: '',
      icon: 'Circle',
      accent: 'ink',
    };
  }
  return meta;
}

/* -------------------------------------------------------------------------
   Primary navigation
   ------------------------------------------------------------------------- */
export interface NavItem {
  label: string;
  href: string;
  description?: string;
  children?: NavItem[];
}

export const primaryNav: NavItem[] = [
  {
    label: 'Library',
    href: '/library',
    description: 'Every researched article, ordered by topic and series',
    children: [
      { label: 'All articles', href: '/library', description: 'Complete index of published research' },
      { label: 'Learning paths', href: '/series', description: 'Structured reading orders with prerequisites' },
      { label: 'Glossary', href: '/glossary', description: 'Definitions, formulas and plain-English equivalents' },
      { label: 'Reading library', href: '/library/books', description: 'Books, papers and official documents' },
    ],
  },
  {
    label: 'Investment universe',
    href: '/assets',
    description: 'Every legally accessible Indian investment avenue',
    children: [],
  },
  {
    label: 'Compare',
    href: '/compare',
    description: 'Risk, liquidity, tax and cost comparison laboratory',
  },
  {
    label: 'Calculators',
    href: '/calculators',
    description: 'Unit-tested financial mathematics, in the browser',
  },
  {
    label: 'Tax',
    href: '/tax',
    description: 'Versioned Indian investment tax rules with sources',
  },
  {
    label: 'High returns',
    href: '/research/high-return',
    description: 'Forensic investigation of high-return claims',
  },
  {
    label: 'Integrity',
    href: '/integrity',
    description: 'Fraud mechanics, red flags and investor protection',
  },
];

export const footerNav: NavItem[] = [
  { label: 'About Arthanomy', href: '/about' },
  { label: 'Research methodology', href: '/about/methodology' },
  { label: 'Editorial policy', href: '/about/editorial-policy' },
  { label: 'Corrections & updates', href: '/about/corrections' },
  { label: 'Source registry', href: '/sources' },
  { label: 'Data & disclaimers', href: '/disclaimer' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Roadmap & coverage', href: '/roadmap' },
  { label: 'Contact', href: '/contact' },
];

/* -------------------------------------------------------------------------
   Asset universe groups (used by /assets and the comparison engine)
   ------------------------------------------------------------------------- */
export const assetGroups = [
  { id: 'cash-equivalents', name: 'Cash & Cash Equivalents', order: 1 },
  { id: 'bank-deposits', name: 'Bank & Corporate Deposits', order: 2 },
  { id: 'government-securities', name: 'Government Securities & Sovereign Schemes', order: 3 },
  { id: 'high-grade-debt', name: 'High-Quality Debt & Debt Funds', order: 4 },
  { id: 'credit-debt', name: 'Credit-Risk Debt & Private Credit', order: 5 },
  { id: 'indian-equity', name: 'Indian Equity', order: 6 },
  { id: 'international-equity', name: 'International Equity', order: 7 },
  { id: 'precious-metals', name: 'Precious Metals', order: 8 },
  { id: 'real-estate', name: 'Real Estate & Property', order: 9 },
  { id: 'reits-invits', name: 'REITs & InvITs', order: 10 },
  { id: 'alternative-credit', name: 'P2P & Alternative Credit', order: 11 },
  { id: 'private-markets', name: 'Private Markets & Business Ownership', order: 12 },
  { id: 'agriculture-natural', name: 'Agriculture & Natural Assets', order: 13 },
  { id: 'commodities', name: 'Commodities & Derivatives', order: 14 },
  { id: 'insurance-pensions', name: 'Insurance & Retirement Products', order: 15 },
  { id: 'digital-assets', name: 'Digital & Emerging Assets', order: 16 },
] as const;

export type AssetGroupId = (typeof assetGroups)[number]['id'];
