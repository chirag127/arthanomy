/**
 * Cross-reference validation across every registry.
 *
 * The Zod schemas in `src/content.config.ts` validate the shape of each item at
 * build time. These tests cover what Zod cannot: that ids referenced *between*
 * registries actually exist. A broken glossary cross-link or a calculator
 * referenced by an asset but missing from the registry is a build-time bug, not
 * a runtime one, and this is where it is caught.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { categories, assetGroups } from '../src/config/site';

function load<T>(relativePath: string): T {
  const url = new URL(`../${relativePath}`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as T;
}

const categoryIds = new Set(categories.map((c) => c.id));
const groupIds = new Set<string>(assetGroups.map((g) => g.id));

interface Source {
  id: string;
  title: string;
  publisher: string;
  tier: string;
  url?: string;
  documentDate?: string;
  accessedAt?: string;
}

interface TaxRule {
  id: string;
  title: string;
  assessmentYear: string;
  effectiveFrom: string;
  provision: string;
  sourceIds: string[];
  verifiedAt: string;
  reviewStatus: string;
}

interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  category?: string;
  seeAlso?: string[];
  sourceIds?: string[];
}

interface Asset {
  id: string;
  name: string;
  group: string;
  category: string;
  taxRuleIds?: string[];
  relatedCalculators?: { id: string }[] | string[];
  oneLiner: string;
}

interface Brief {
  id: string;
  title: string;
  category: string;
  series?: string;
  priority: number;
  status: string;
  brief: string;
  requiredSources?: string[];
  dependencies?: string[];
  qualityStatus?: string;
}

interface SeriesEntry {
  id: string;
  title: string;
  question: string;
  category: string;
  order: number;
  prerequisites?: string[];
  relatedCalculators?: string[];
  glossaryTerms?: string[];
  bibliography?: string[];
}

interface LibraryItem {
  id: string;
  title: string;
  type: string;
  seriesIds?: string[];
}

interface CalculatorDef {
  id: string;
  category: string;
  inputs: { id: string; default?: unknown }[];
  limitations?: string[];
}

const sources = load<Source[]>('src/data/sources/registry.json');
const taxRules = load<TaxRule[]>('src/data/tax-rules/rules.json');
const glossary = load<GlossaryTerm[]>('src/data/glossary/terms.json');
const assets = load<Asset[]>('src/data/assets/universe.json');
const briefs = load<Brief[]>('src/data/roadmap/briefs.json');
const series = load<SeriesEntry[]>('src/data/series/series.json');
const library = load<LibraryItem[]>('src/data/library/items.json');
const calculators = load<CalculatorDef[]>('src/data/calculators/definitions.json');

const sourceIds = new Set(sources.map((s) => s.id));
const taxRuleIds = new Set(taxRules.map((r) => r.id));
const glossaryIds = new Set(glossary.map((t) => t.id));
const seriesIds = new Set(series.map((s) => s.id));
const calculatorIds = new Set(calculators.map((c) => c.id));

function hasUniqueIds(items: { id: string }[]): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const item of items) {
    if (seen.has(item.id)) dupes.push(item.id);
    seen.add(item.id);
  }
  return dupes;
}

describe('source registry', () => {
  it('has unique ids and well-formed urls', () => {
    expect(sources.length).toBeGreaterThanOrEqual(40);
    expect(hasUniqueIds(sources)).toEqual([]);
    for (const source of sources) {
      expect(source.title.length, source.id).toBeGreaterThan(3);
      expect(source.publisher.length, source.id).toBeGreaterThan(2);
      if (source.url) {
        expect(() => new URL(source.url as string), source.id).not.toThrow();
      }
    }
  });
});

describe('tax rules', () => {
  it('has unique ids with parseable dates and real sources', () => {
    expect(hasUniqueIds(taxRules)).toEqual([]);
    for (const rule of taxRules) {
      expect(Number.isNaN(Date.parse(rule.effectiveFrom)), `${rule.id} effectiveFrom`).toBe(false);
      expect(Number.isNaN(Date.parse(rule.verifiedAt)), `${rule.id} verifiedAt`).toBe(false);
      expect(['verified', 'provisional', 'needs-update', 'superseded']).toContain(rule.reviewStatus);
      expect(rule.sourceIds.length, `${rule.id} has no sources`).toBeGreaterThan(0);
      for (const sid of rule.sourceIds) {
        expect(sourceIds.has(sid), `${rule.id} -> unknown source ${sid}`).toBe(true);
      }
    }
  });
});

describe('glossary', () => {
  it('has unique ids, valid categories and resolving cross-links', () => {
    expect(glossary.length).toBeGreaterThanOrEqual(300);
    expect(hasUniqueIds(glossary)).toEqual([]);
    for (const term of glossary) {
      if (term.category) {
        expect(categoryIds.has(term.category), `${term.id} bad category ${term.category}`).toBe(true);
      }
      expect(term.definition.length, term.id).toBeGreaterThan(40);
      for (const link of term.seeAlso ?? []) {
        expect(glossaryIds.has(link), `${term.id} -> unknown term ${link}`).toBe(true);
      }
      for (const sid of term.sourceIds ?? []) {
        expect(sourceIds.has(sid), `${term.id} -> unknown source ${sid}`).toBe(true);
      }
    }
  });
});

describe('asset universe', () => {
  it('has valid groups, categories, tax rules and calculator references', () => {
    expect(assets.length).toBeGreaterThanOrEqual(60);
    expect(hasUniqueIds(assets)).toEqual([]);
    for (const asset of assets) {
      expect(categoryIds.has(asset.category), `${asset.id} bad category`).toBe(true);
      expect(groupIds.has(asset.group), `${asset.id} bad group ${asset.group}`).toBe(true);
      expect(asset.oneLiner.length, asset.id).toBeGreaterThan(20);
      for (const ruleId of asset.taxRuleIds ?? []) {
        expect(taxRuleIds.has(ruleId), `${asset.id} -> unknown tax rule ${ruleId}`).toBe(true);
      }
      for (const ref of asset.relatedCalculators ?? []) {
        const cid = typeof ref === 'string' ? ref : ref.id;
        expect(calculatorIds.has(cid), `${asset.id} -> unknown calculator ${cid}`).toBe(true);
      }
    }
  });
});

describe('roadmap briefs', () => {
  it('has unique ids, valid classification and resolving dependencies', () => {
    expect(briefs.length).toBeGreaterThanOrEqual(500);
    expect(hasUniqueIds(briefs)).toEqual([]);
    const briefIds = new Set(briefs.map((b) => b.id));
    for (const brief of briefs) {
      expect(categoryIds.has(brief.category), `${brief.id} bad category ${brief.category}`).toBe(true);
      expect(brief.priority).toBeGreaterThanOrEqual(1);
      expect(brief.priority).toBeLessThanOrEqual(5);
      expect(brief.brief.length, brief.id).toBeGreaterThanOrEqual(20);
      if (brief.series) {
        expect(seriesIds.has(brief.series), `${brief.id} bad series ${brief.series}`).toBe(true);
      }
      for (const sid of brief.requiredSources ?? []) {
        expect(sourceIds.has(sid), `${brief.id} -> unknown source ${sid}`).toBe(true);
      }
      for (const dep of brief.dependencies ?? []) {
        expect(briefIds.has(dep), `${brief.id} -> unknown dependency ${dep}`).toBe(true);
      }
    }
  });
});

describe('series', () => {
  it('has unique ids, valid categories and resolving references', () => {
    expect(hasUniqueIds(series)).toEqual([]);
    for (const entry of series) {
      expect(categoryIds.has(entry.category), `${entry.id} bad category`).toBe(true);
      for (const prereq of entry.prerequisites ?? []) {
        expect(seriesIds.has(prereq), `${entry.id} -> unknown prerequisite ${prereq}`).toBe(true);
      }
      for (const cid of entry.relatedCalculators ?? []) {
        expect(calculatorIds.has(cid), `${entry.id} -> unknown calculator ${cid}`).toBe(true);
      }
      for (const term of entry.glossaryTerms ?? []) {
        expect(glossaryIds.has(term), `${entry.id} -> unknown glossary term ${term}`).toBe(true);
      }
      for (const sourceId of entry.bibliography ?? []) {
        expect(sourceIds.has(sourceId), `${entry.id} -> unknown bibliography source ${sourceId}`).toBe(true);
      }
    }
    for (const entry of series) {
      const count = briefs.filter((b) => b.series === entry.id).length;
      expect(count, `series ${entry.id} has no briefs`).toBeGreaterThanOrEqual(8);
    }
  });
});

describe('library items', () => {
  it('has unique ids, valid types and series references', () => {
    expect(library.length).toBeGreaterThanOrEqual(60);
    expect(hasUniqueIds(library)).toEqual([]);
    const types = new Set(['book', 'paper', 'report', 'official-document', 'dataset']);
    for (const item of library) {
      expect(types.has(item.type), `${item.id} bad type ${item.type}`).toBe(true);
      for (const sid of item.seriesIds ?? []) {
        expect(seriesIds.has(sid), `${item.id} -> unknown series ${sid}`).toBe(true);
      }
      expect(item.title.length, item.id).toBeGreaterThan(3);
    }
  });
});

describe('calculators', () => {
  it('has unique ids, non-empty limitations and no duplicate input ids', () => {
    expect(calculators.length).toBeGreaterThanOrEqual(60);
    expect(hasUniqueIds(calculators)).toEqual([]);
    for (const calc of calculators) {
      expect(calc.inputs.length, `${calc.id} has no inputs`).toBeGreaterThan(0);
      const inputIds = calc.inputs.map((i) => i.id);
      expect(new Set(inputIds).size, `${calc.id} duplicate input ids`).toBe(inputIds.length);
      expect((calc.limitations ?? []).length, `${calc.id} has no limitations`).toBeGreaterThan(0);
    }
  });
});
