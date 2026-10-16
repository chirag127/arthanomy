/**
 * Content pipeline invariants.
 *
 * The pipeline in `scripts/content-pipeline/` builds writing packets from the
 * roadmap, series and registry files. These tests assert the data the packets
 * depend on is internally consistent, so a wave of generated articles cannot be
 * built on a broken brief.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function load<T>(relativePath: string): T {
  const url = new URL(`../${relativePath}`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as T;
}

interface Brief {
  id: string;
  title: string;
  category: string;
  series?: string;
  seriesOrder?: number;
  priority: number;
  difficulty: string;
  brief: string;
  requiredSources: string[];
  dependencies: string[];
}

interface SeriesEntry {
  id: string;
  order: number;
  readingOrder: string[];
  plannedCount?: number;
  relatedCalculators: string[];
  glossaryTerms: string[];
  bibliography: string[];
}

const briefs = load<Brief[]>("src/data/roadmap/briefs.json");
const series = load<SeriesEntry[]>("src/data/series/series.json");
const sources = load<{ id: string }[]>("src/data/sources/registry.json");
const glossary = load<{ id: string }[]>("src/data/glossary/terms.json");
const calculators = load<{ id: string }[]>(
  "src/data/calculators/definitions.json",
);

const sourceIds = new Set(sources.map((s) => s.id));
const glossaryIds = new Set(glossary.map((g) => g.id));
const calculatorIds = new Set(calculators.map((c) => c.id));
const briefIds = new Set(briefs.map((b) => b.id));

describe("roadmap briefs", () => {
  it("has a unique id for every brief", () => {
    expect(briefIds.size).toBe(briefs.length);
  });

  it("uses file-name-safe ids (they become article file names)", () => {
    const bad = briefs.filter((b) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(b.id));
    expect(bad.map((b) => b.id)).toEqual([]);
  });

  it("requires only sources that exist in the registry", () => {
    const bad: string[] = [];
    for (const b of briefs) {
      for (const id of b.requiredSources) {
        if (!sourceIds.has(id)) bad.push(`${b.id} -> ${id}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("depends only on briefs that exist", () => {
    const bad: string[] = [];
    for (const b of briefs) {
      for (const id of b.dependencies) {
        if (!briefIds.has(id)) bad.push(`${b.id} -> ${id}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("gives every series brief a seriesOrder", () => {
    const bad = briefs.filter(
      (b) => b.series && typeof b.seriesOrder !== "number",
    );
    expect(bad.map((b) => b.id)).toEqual([]);
  });
});

describe("series plan", () => {
  it("every brief belongs to a known series", () => {
    const seriesIds = new Set(series.map((s) => s.id));
    const bad = briefs.filter((b) => b.series && !seriesIds.has(b.series));
    expect(bad.map((b) => b.id)).toEqual([]);
  });

  it("readingOrder is the complete brief list in seriesOrder sequence", () => {
    for (const s of series) {
      const expected = briefs
        .filter((b) => b.series === s.id)
        .sort(
          (a, b) =>
            (a.seriesOrder ?? 999) - (b.seriesOrder ?? 999) ||
            a.id.localeCompare(b.id),
        )
        .map((b) => b.id);
      expect(s.readingOrder, `series ${s.id}`).toEqual(expected);
    }
  });

  it("plannedCount matches the number of briefs, where stated", () => {
    for (const s of series) {
      if (s.plannedCount == null) continue;
      expect(s.plannedCount, `series ${s.id}`).toBe(s.readingOrder.length);
    }
  });

  it("references only registered glossary terms, calculators and sources", () => {
    for (const s of series) {
      expect(
        s.glossaryTerms.filter((id) => !glossaryIds.has(id)),
        `series ${s.id} glossary`,
      ).toEqual([]);
      expect(
        s.relatedCalculators.filter((id) => !calculatorIds.has(id)),
        `series ${s.id} calculators`,
      ).toEqual([]);
      expect(
        s.bibliography.filter((id) => !sourceIds.has(id)),
        `series ${s.id} bibliography`,
      ).toEqual([]);
    }
  });
});
