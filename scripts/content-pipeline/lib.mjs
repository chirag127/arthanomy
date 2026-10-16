/**
 * Arthanomy content pipeline — shared library.
 *
 * Loads the roadmap, series and registry data and turns a brief into a
 * self-contained "packet": everything a writer needs to produce one article
 * without inventing anything. Packets are the unit of work in the queue.
 *
 * Nothing here writes content. It only reads registries and describes work.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const readJson = (rel) => JSON.parse(readFileSync(resolve(ROOT, rel), "utf8"));

export const loadBriefs = () => readJson("src/data/roadmap/briefs.json");
export const loadSeries = () => readJson("src/data/series/series.json");
export const loadSources = () => readJson("src/data/sources/registry.json");
export const loadGlossary = () => readJson("src/data/glossary/terms.json");
export const loadCalculators = () =>
  readJson("src/data/calculators/definitions.json");
export const loadTaxRules = () => readJson("src/data/tax-rules/rules.json");

export const ARTICLES_DIR = resolve(ROOT, "src/content/articles");
export const PACKETS_DIR = resolve(ROOT, "pipeline/packets");
export const STATE_FILE = resolve(ROOT, "pipeline/state.json");

/** Brief ids that already have an MDX file on disk. */
export function publishedIds() {
  if (!existsSync(ARTICLES_DIR)) return new Set();
  return new Set(
    readdirSync(ARTICLES_DIR)
      .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
      .map((f) => f.replace(/\.mdx?$/, "")),
  );
}

/**
 * Word target for an article, derived from difficulty and priority.
 * Priority-1 foundational pieces are the "front door" and get the most room.
 */
export function wordTarget(brief) {
  const base =
    {
      foundational: 1400,
      intermediate: 1600,
      advanced: 1800,
      expert: 1800,
    }[brief.difficulty] ?? 1500;
  const priorityBoost =
    brief.priority === 1 ? 400 : brief.priority === 2 ? 150 : 0;
  const lo = base + priorityBoost;
  return { min: lo, max: lo + 700 };
}

function uniqueBy(items, key = "id") {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (item == null || seen.has(item[key])) continue;
    seen.add(item[key]);
    out.push(item);
  }
  return out;
}

/**
 * A writer's packet: the brief plus the exact, closed sets of ids it may cite.
 * `required` sources are mandatory; `optional` sources are plausible and must
 * still only be cited with a truthful `supports` note.
 */
export function buildPacket(brief, ctx) {
  const { series, sources, glossary, calculators, taxRules, briefs } = ctx;
  const seriesMeta = brief.series
    ? (series.find((s) => s.id === brief.series) ?? null)
    : null;

  const required = brief.requiredSources
    .map((id) => sources.find((s) => s.id === id))
    .filter(Boolean)
    .map((s) => ({
      id: s.id,
      title: s.title,
      publisher: s.publisher,
      tier: s.tier,
      url: s.url ?? null,
      supports: s.supports,
      required: true,
    }));

  const requiredIds = new Set(required.map((s) => s.id));

  const topicTags = new Set([
    brief.category,
    ...(seriesMeta ? [seriesMeta.category] : []),
  ]);
  const bibliographyIds = new Set(seriesMeta?.bibliography ?? []);
  /* A writer may cite any source the article's own series treats as core
     reading, plus sources whose declared topic covers this article's subject.
     Bibliography sources come first because they are the series' chosen canon. */
  const optional = sources
    .filter((s) => !requiredIds.has(s.id))
    .filter(
      (s) =>
        bibliographyIds.has(s.id) ||
        (s.topic ?? []).some((t) => topicTags.has(t)),
    )
    .sort(
      (a, b) =>
        Number(bibliographyIds.has(b.id)) - Number(bibliographyIds.has(a.id)),
    )
    .slice(0, 14)
    .map((s) => ({
      id: s.id,
      title: s.title,
      publisher: s.publisher,
      tier: s.tier,
      url: s.url ?? null,
      supports: s.supports,
      required: false,
    }));

  const glossaryIds = seriesMeta?.glossaryTerms ?? [];
  const glossaryTerms = glossaryIds
    .map((id) => glossary.find((t) => t.id === id))
    .filter(Boolean)
    .map((t) => ({ id: t.id, term: t.term, definition: t.definition }));

  const calculatorIds = (seriesMeta?.relatedCalculators ?? []).filter((id) =>
    calculators.some((c) => c.id === id),
  );
  const calculatorRefs = calculatorIds.map((id) => {
    const c = calculators.find((x) => x.id === id);
    return { id, label: c.name, shortDescription: c.shortDescription };
  });

  const rules =
    brief.category === "taxation" || brief.series === "taxation-of-investments"
      ? taxRules.map((r) => ({
          id: r.id,
          title: r.title,
          assetClass: r.assetClass,
          incomeType: r.incomeType,
          provision: r.provision,
          assessmentYear: r.assessmentYear,
          financialYear: r.financialYear,
          taxRate: r.taxRate,
          exemptionLimit: r.exemptionLimit ?? null,
          holdingPeriodRule: r.holdingPeriodRule,
          surchargeRule: r.surchargeRule,
          cessRule: r.cessRule,
          setOffRule: r.setOffRule,
          conditions: r.conditions ?? [],
          workedExampleSummary: r.workedExampleSummary ?? null,
          sourceIds: r.sourceIds,
          reviewStatus: r.reviewStatus,
          effectiveFrom: r.effectiveFrom,
          notes: r.notes ?? null,
        }))
      : [];

  const relatedBriefs = briefs
    .filter((b) => b.series === brief.series && b.id !== brief.id)
    .sort((a, b) => (a.seriesOrder ?? 999) - (b.seriesOrder ?? 999))
    .slice(0, 8)
    .map((b) => ({
      id: b.id,
      title: b.title,
      seriesOrder: b.seriesOrder ?? null,
    }));

  return {
    brief,
    series: seriesMeta
      ? {
          id: seriesMeta.id,
          title: seriesMeta.title,
          question: seriesMeta.question,
          summary: seriesMeta.summary,
          difficulty: seriesMeta.difficulty,
          order: seriesMeta.order,
        }
      : null,
    wordTarget: wordTarget(brief),
    sources: { required, optional },
    glossaryTerms,
    calculators: calculatorRefs,
    taxRules: rules,
    relatedBriefs,
    target: {
      path: `src/content/articles/${brief.id}.mdx`,
      route: `/library/${brief.id}`,
    },
  };
}

export function buildContext() {
  return {
    series: loadSeries(),
    sources: loadSources(),
    glossary: loadGlossary(),
    calculators: loadCalculators(),
    taxRules: loadTaxRules(),
    briefs: loadBriefs(),
  };
}

/** Deterministic wave partitioning: priority first, then series order, then id. */
export function queueOrder(briefs, written) {
  const rank = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };
  return briefs
    .filter((b) => !written.has(b.id))
    .sort((a, b) => {
      const p = (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
      if (p !== 0) return p;
      const s = (a.series ?? "").localeCompare(b.series ?? "");
      if (s !== 0) return s;
      const o = (a.seriesOrder ?? 999) - (b.seriesOrder ?? 999);
      if (o !== 0) return o;
      return a.id.localeCompare(b.id);
    });
}

export function selectBriefs(briefs, opts = {}) {
  let list = briefs;
  if (opts.ids?.length) list = list.filter((b) => opts.ids.includes(b.id));
  if (opts.series) list = list.filter((b) => b.series === opts.series);
  if (opts.category) list = list.filter((b) => b.category === opts.category);
  if (opts.priority) list = list.filter((b) => b.priority === opts.priority);
  return list;
}

/** Supports `--flag`, `--name=value` and `--name value`. */
export function arg(name, fallback = undefined) {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === `--${name}`) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) return next;
      return true;
    }
    if (a.startsWith(`--${name}=`)) return a.slice(name.length + 3);
  }
  return fallback;
}
