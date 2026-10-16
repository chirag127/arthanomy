/**
 * Completes the series plan: fills `readingOrder` on every series with the
 * brief ids in the intended reading sequence (seriesOrder, then id).
 *
 * Deterministic and idempotent. Run with --check to verify without writing.
 *
 *   node scripts/content-pipeline/build-reading-order.mjs [--check]
 */
import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, loadBriefs, loadSeries } from "./lib.mjs";

const check = process.argv.includes("--check");
const briefs = loadBriefs();
const series = loadSeries();

let changed = 0;
const problems = [];

for (const s of series) {
  const ordered = briefs
    .filter((b) => b.series === s.id)
    .sort(
      (a, b) =>
        (a.seriesOrder ?? 999) - (b.seriesOrder ?? 999) ||
        a.id.localeCompare(b.id),
    )
    .map((b) => b.id);

  if (s.plannedCount != null && s.plannedCount !== ordered.length) {
    problems.push(
      `${s.id}: plannedCount=${s.plannedCount} but ${ordered.length} briefs reference it`,
    );
  }
  const before = JSON.stringify(s.readingOrder ?? []);
  if (before !== JSON.stringify(ordered)) {
    s.readingOrder = ordered;
    changed += 1;
  }
}

const orphans = briefs.filter((b) => !series.some((s) => s.id === b.series));
if (orphans.length)
  problems.push(`${orphans.length} briefs reference an unknown series`);

if (problems.length) {
  console.error("Series plan problems:");
  for (const p of problems) console.error("  - " + p);
  process.exitCode = 1;
}

if (check) {
  console.log(`${changed} series would change; ${problems.length} problems.`);
  process.exit(process.exitCode ?? 0);
}

const file = resolve(ROOT, "src/data/series/series.json");
const json = JSON.stringify(series, null, 2) + "\n";
if (readFileSync(file, "utf8") !== json) {
  writeFileSync(file, json, "utf8");
}
const total = series.reduce((n, s) => n + s.readingOrder.length, 0);
console.log(
  `readingOrder filled for ${series.length} series (${changed} changed); ${total} briefs ordered; ${problems.length} problems.`,
);
