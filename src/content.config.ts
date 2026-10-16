import { defineCollection, z } from 'astro:content';
import { file, glob } from 'astro/loaders';

/* ==========================================================================
   ARTHANOMY CONTENT SCHEMAS
   Every published page carries provenance: who researched it, when, which
   sources support it, and what state of review it is in. Numeric quality
   scores are editorial aids, never proof of correctness.
   ========================================================================== */

export const CATEGORY_IDS = [
  'investment-basics',
  'equity',
  'mutual-funds',
  'debt',
  'p2p-lending',
  'gold-silver',
  'real-estate',
  'reits-invits',
  'derivatives',
  'private-markets',
  'agriculture',
  'insurance-pensions',
  'international',
  'digital-assets',
  'taxation',
  'asset-allocation',
  'portfolio-operations',
  'financial-system',
  'financial-mathematics',
  'fraud-risk',
] as const;

export const SERIES_IDS = [
  'science-of-returns',
  'equity-mastery',
  'mutual-fund-atlas',
  'debt-encyclopedia',
  'p2p-first-principles',
  'gold-precious-metals',
  'real-estate-property',
  'reits-invits-explained',
  'derivatives-lab',
  'private-markets-playbook',
  'agriculture-natural-assets',
  'insurance-pensions-decoded',
  'global-investing',
  'digital-assets-lab',
  'taxation-of-investments',
  'portfolio-theory',
  'operating-a-portfolio',
  'indian-financial-system',
  'financial-mathematics',
  'high-return-alternatives',
  'fraud-investor-protection',
] as const;

export const DIFFICULTIES = ['foundational', 'intermediate', 'advanced', 'expert'] as const;

export const ARTICLE_STATUSES = [
  'planned',
  'researching',
  'drafting',
  'needs-verification',
  'review',
  'published',
  'needs-update',
  'archived',
] as const;

/** Source quality classification used across the whole library. */
export const SOURCE_TIERS = [
  'primary-official', // RBI, SEBI, CBDT, Gazette, statute, exchange, regulator data
  'audited-disclosure', // audited financials, scheme documents, offer documents
  'academic', // peer-reviewed papers, university research, working papers
  'reputable-secondary', // established financial press, reference works
  'industry-research', // AMFI/CRISIL/industry body research, rating agency methodology
  'market-commentary', // broker notes, fund manager commentary, blogs
  'unverified', // promotional or unverifiable claims — flagged, never relied upon
] as const;

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'unavailable'] as const;

const sourceRef = z.object({
  /** id from the source registry (src/data/sources/registry.json) */
  id: z.string(),
  /** what this source supports in *this* article */
  supports: z.string().optional(),
});

const faqSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const calculatorRef = z.object({
  id: z.string(),
  label: z.string().optional(),
});

const articleSchema = z.object({
  title: z.string().max(140),
  description: z.string().min(40).max(400),
  /** Short label used in navigational lists (falls back to title). */
  shortTitle: z.string().max(80).optional(),

  category: z.enum(CATEGORY_IDS),
  series: z.enum(SERIES_IDS).optional(),
  seriesOrder: z.number().int().positive().optional(),
  topics: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),

  difficulty: z.enum(DIFFICULTIES).default('intermediate'),
  status: z.enum(ARTICLE_STATUSES).default('published'),

  /** Publication surface: `library` articles are full research pieces,
      `reference` pages are living documents (glossary-style, tax tables). */
  kind: z.enum(['research', 'reference', 'explainer', 'case-study', 'comparison']).default('research'),

  author: z.string().default('Chirag Singhal'),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  /** Date the underlying research was performed. */
  researchDate: z.coerce.date().optional(),
  /** Date a human last reviewed the claims and sources. */
  reviewedAt: z.coerce.date().optional(),
  /** Next scheduled review — surfaced in maintenance reports. */
  reviewDue: z.coerce.date().optional(),

  readingMinutes: z.number().int().positive().optional(),
  keyTakeaways: z.array(z.string()).default([]),
  faqs: z.array(faqSchema).default([]),
  /** glossary term ids used in this article */
  glossaryTerms: z.array(z.string()).default([]),
  relatedCalculators: z.array(calculatorRef).default([]),
  relatedArticles: z.array(z.string()).default([]),
  /** Scheduled for a future series but published as a stub? Not allowed:
      articles are either substantive or absent. `draft: true` excludes from index. */
  draft: z.boolean().default(false),
  featured: z.boolean().default(false),

  sources: z.array(sourceRef).default([]),
  dataConfidence: z.enum(CONFIDENCE_LEVELS).optional(),

  /** Plain-English explanations are required for advanced material. */
  hasPlainEnglish: z.boolean().default(false),
  hasWorkedExample: z.boolean().default(false),
  hasDiagram: z.boolean().default(false),
  hasChart: z.boolean().default(false),

  /** Legal/tax/regulatory caveats that must be shown before the body. */
  warnings: z.array(z.string()).default([]),
  /** Unresolved research questions surfaced to readers. */
  openQuestions: z.array(z.string()).default([]),
  /** If the subject matter changes materially, note the applicable period. */
  applicablePeriods: z.array(z.string()).default([]),
  /** Historic/current availability note, e.g. "closed to new subscriptions". */
  productStatus: z.string().optional(),
  seoTitle: z.string().max(80).optional(),
  socialImage: z.string().optional(),
  canonical: z.string().optional(),
});

export const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: articleSchema,
});

/* ---- Series ---------------------------------------------------------- */
export const series = defineCollection({
  loader: file('./src/data/series/series.json'),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    question: z.string(),
    summary: z.string(),
    difficulty: z.enum(DIFFICULTIES),
    category: z.enum(CATEGORY_IDS),
    /** Order of the series in navigation */
    order: z.number().int(),
    /** Prerequisite series ids */
    prerequisites: z.array(z.string()).default([]),
    /** Materia/reading order: article slugs in the intended sequence */
    readingOrder: z.array(z.string()).default([]),
    relatedCalculators: z.array(z.string()).default([]),
    conceptMap: z.string().optional(), // mermaid source
    glossaryTerms: z.array(z.string()).default([]),
    bibliography: z.array(z.string()).default([]),
    openQuestions: z.array(z.string()).default([]),
    plannedCount: z.number().int().optional(),
  }),
});

/* ---- Glossary -------------------------------------------------------- */
export const glossary = defineCollection({
  loader: file('./src/data/glossary/terms.json'),
  schema: z.object({
    id: z.string(),
    term: z.string(),
    fullName: z.string().optional(),
    definition: z.string(),
    plainEnglish: z.string().optional(),
    category: z.enum(CATEGORY_IDS).optional(),
    seeAlso: z.array(z.string()).default([]),
    formula: z.string().optional(), // LaTeX
    example: z.string().optional(),
    sourceIds: z.array(z.string()).default([]),
  }),
});

/* ---- Source registry -------------------------------------------------- */
export const sources = defineCollection({
  loader: file('./src/data/sources/registry.json'),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    publisher: z.string(),
    tier: z.enum(SOURCE_TIERS),
    url: z.string().url().optional(),
    documentDate: z.coerce.date().optional(),
    accessedAt: z.coerce.date(),
    /** What claims this source is used to support */
    supports: z.string(),
    /** Availability / licensing note */
    note: z.string().optional(),
    topic: z.array(z.string()).default([]),
    reviewDue: z.coerce.date().optional(),
  }),
});

/* ---- Investment universe (asset classes) ------------------------------ */
export const assets = defineCollection({
  loader: file('./src/data/assets/universe.json'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    group: z.string(),
    category: z.enum(CATEGORY_IDS),
    /** Plain-English one-liner */
    oneLiner: z.string(),
    returnMechanism: z.string(),
    /** Qualitative + quantitative comparison metrics. `null` means
        "not applicable / not independently verifiable" — never 0. */
    expectedReturn: z.string().optional(),
    historicalReturnNote: z.string().optional(),
    volatility: z.enum(['very-low', 'low', 'moderate', 'high', 'very-high', 'unavailable']),
    maxDrawdownNote: z.string().optional(),
    liquidity: z.enum(['same-day', 'days', 'weeks', 'months', 'years', 'illiquid']),
    lockIn: z.string().optional(),
    minimumInvestment: z.string().optional(),
    taxTreatment: z.string(),
    taxRuleIds: z.array(z.string()).default([]),
    fees: z.string(),
    inflationProtection: z.enum(['none', 'partial', 'possible', 'strong']),
    currencyExposure: z.enum(['INR', 'mixed', 'foreign']),
    counterpartyRisk: z.enum(['sovereign', 'regulated-intermediary', 'corporate', 'platform', 'self-custody', 'mixed']),
    creditRisk: z.enum(['none', 'sovereign', 'high-grade', 'mixed', 'sub-investment-grade', 'unrated', 'not-applicable']),
    regulatoryProtection: z.enum(['statutory', 'regulated', 'light-touch', 'unregulated-relative', 'prohibited']),
    investorEligibility: z.string(),
    operationalWorkload: z.enum(['none', 'low', 'moderate', 'high', 'business-level']),
    leverageEmbedded: z.enum(['none', 'internal', 'borrowed-optional', 'inherent']),
    complexity: z.enum(['simple', 'moderate', 'complex', 'specialist']),
    diversification: z.enum(['single-asset', 'narrow', 'moderate', 'broad']),
    evidenceQuality: z.enum(['strong', 'moderate', 'limited', 'weak']),
    dataConfidence: z.enum(CONFIDENCE_LEVELS),
    /** Explicitly artificial data markers */
    illustrativeMetrics: z
      .object({
        expectedReturnPct: z.number().optional(),
        volatilityPct: z.number().optional(),
        note: z.string(),
      })
      .optional(),
    risks: z.array(z.string()).default([]),
    suitability: z.string(),
    commonMistakes: z.array(z.string()).default([]),
    relatedArticles: z.array(z.string()).default([]),
    relatedCalculators: z.array(z.string()).default([]),
    sourceIds: z.array(z.string()).default([]),
    lastVerified: z.coerce.date().optional(),
  }),
});

/* ---- Tax rules -------------------------------------------------------- */
export const taxRules = defineCollection({
  loader: file('./src/data/tax-rules/rules.json'),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    assetClass: z.string(),
    incomeType: z.string(),
    /** Assessment year this applies to, e.g. "AY 2026-27 (FY 2025-26)" */
    assessmentYear: z.string(),
    financialYear: z.string(),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().optional(),
    /** statute / section / schedule reference */
    provision: z.string(),
    holdingPeriodRule: z.string(),
    taxRate: z.string(),
    exemptionLimit: z.string().optional(),
    surchargeRule: z.string(),
    cessRule: z.string(),
    setOffRule: z.string(),
    conditions: z.array(z.string()).default([]),
    workedExampleSummary: z.string().optional(),
    sourceIds: z.array(z.string()),
    verifiedAt: z.coerce.date(),
    reviewedBy: z.string().default('Chirag Singhal'),
    reviewStatus: z.enum(['verified', 'provisional', 'needs-update', 'superseded']),
    supersedes: z.string().optional(),
    notes: z.string().optional(),
  }),
});

/* ---- Books and research library --------------------------------------- */
export const libraryItems = defineCollection({
  loader: file('./src/data/library/items.json'),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    authors: z.array(z.string()),
    year: z.number().int().optional(),
    edition: z.string().optional(),
    publisher: z.string().optional(),
    isbn: z.string().optional(),
    type: z.enum(['book', 'paper', 'report', 'official-document', 'dataset']),
    region: z.enum(['india', 'international', 'both']),
    subjects: z.array(z.string()),
    difficulty: z.enum(DIFFICULTIES),
    prerequisites: z.array(z.string()).default([]),
    whyItMatters: z.string(),
    strengths: z.array(z.string()).default([]),
    limitations: z.array(z.string()).default([]),
    seriesIds: z.array(z.string()).default([]),
    referenceUrl: z.string().url().optional(),
    verifiedAt: z.coerce.date().optional(),
  }),
});

/* ---- Calculators ------------------------------------------------------ */
export const calculators = defineCollection({
  loader: file('./src/data/calculators/definitions.json'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    shortDescription: z.string(),
    category: z.enum([
      'returns',
      'planning',
      'debt',
      'fixed-income',
      'portfolio',
      'risk',
      'real-estate',
      'alternatives',
      'tax',
      'derivatives',
    ]),
    difficulty: z.enum(DIFFICULTIES).default('intermediate'),
    /** Formula explanations rendered with KaTeX */
    formulas: z
      .array(
        z.object({
          latex: z.string(),
          label: z.string(),
          assumption: z.string().optional(),
        }),
      )
      .default([]),
    inputs: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          unit: z.string().optional(),
          kind: z.enum(['currency', 'percent', 'number', 'years', 'date', 'select', 'toggle']),
          min: z.number().optional(),
          max: z.number().optional(),
          default: z.union([z.number(), z.string(), z.boolean()]),
          help: z.string().optional(),
          options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
        }),
      )
      .default([]),
    workedExample: z.string().optional(),
    limitations: z.array(z.string()).default([]),
    relatedArticles: z.array(z.string()).default([]),
    relatedCalculators: z.array(z.string()).default([]),
    engine: z.string().optional(),
  }),
});

/* ---- Article roadmap (500+ briefs) ------------------------------------ */
export const roadmap = defineCollection({
  loader: file('./src/data/roadmap/briefs.json'),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    category: z.enum(CATEGORY_IDS),
    series: z.enum(SERIES_IDS).optional(),
    seriesOrder: z.number().int().optional(),
    priority: z.number().int().min(1).max(5),
    difficulty: z.enum(DIFFICULTIES),
    status: z.enum(ARTICLE_STATUSES),
    brief: z.string().min(20),
    requiredSources: z.array(z.string()).default([]),
    dependencies: z.array(z.string()).default([]),
    researchDate: z.coerce.date().optional(),
    reviewDate: z.coerce.date().optional(),
    qualityStatus: z
      .enum(['not-reviewed', 'automated-checks-passed', 'editorial-review', 'verified', 'failing'])
      .default('not-reviewed'),
    /** Path to the published content, if it exists */
    contentPath: z.string().optional(),
  }),
});

/* ---- Registry ----------------------------------------------------------
   Astro reads collections from this single object export. The individual
   definitions above are consts so they can be referenced by the tests.
   ------------------------------------------------------------------------ */
export const collections = {
  articles,
  series,
  glossary,
  sources,
  assets,
  taxRules,
  libraryItems,
  calculators,
  roadmap,
};
