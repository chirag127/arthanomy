/**
 * Content queue manifest — the resumable status of the article library.
 *
 * Reports briefs written vs queued, by series / priority / category, and
 * verifies that every MDX on disk corresponds to a real brief (no orphans).
 *
 *   node scripts/content-pipeline/manifest.mjs [--json] [--limit N]
 */
import { readdirSync } from "node:fs";
import {
  loadBriefs,
  loadSeries,
  publishedIds,
  queueOrder,
  arg,
  ARTICLES_DIR,
} from "./lib.mjs";

const asJson = arg("json", false);
const limit = Number(arg("limit", 40));

const briefs = loadBriefs();
const series = loadSeries();
const written = publishedIds();

const briefIds = new Set(briefs.map((b) => b.id));
const orphans = [...written].filter((id) => !briefIds.has(id));

const queue = queueOrder(briefs, written);
const bySeries = series.map((s) => {
  const list = briefs.filter((b) => b.series === s.id);
  const done = list.filter((b) => written.has(b.id)).length;
  return {
    id: s.id,
    order: s.order,
    planned: list.length,
    written: done,
    remaining: list.length - done,
  };
});
const byPriority = [1, 2, 3, 4, 5].map((p) => {
  const list = briefs.filter((b) => b.priority === p);
  return {
    priority: p,
    planned: list.length,
    written: list.filter((b) => written.has(b.id)).length,
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    briefs: briefs.length,
    written: briefs.filter((b) => written.has(b.id)).length,
    queued: queue.length,
    orphanFiles: orphans.length,
  },
  bySeries,
  byPriority,
  orphans,
  nextUp: queue
    .slice(0, limit)
    .map((b) => ({
      id: b.id,
      series: b.series,
      priority: b.priority,
      difficulty: b.difficulty,
      title: b.title,
    })),
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const t = report.totals;
  console.log(
    `Arthanomy content queue — ${t.written}/${t.briefs} briefs published, ${t.queued} queued`,
  );
  if (t.orphanFiles)
    console.log(
      `  WARNING: ${t.orphanFiles} MDX files have no matching brief: ${orphans.join(", ")}`,
    );
  console.log("");
  console.log("By series:");
  for (const s of bySeries) {
    const bar = s.planned ? Math.round((s.written / s.planned) * 20) : 0;
    console.log(
      `  ${String(s.order).padStart(2)}. ${s.id.padEnd(28)} ${String(s.written).padStart(3)}/${String(s.planned).padEnd(3)} ${"#".repeat(bar)}${".".repeat(20 - bar)}`,
    );
  }
  console.log("");
  console.log("By priority:");
  for (const p of byPriority)
    console.log(`  P${p.priority}: ${p.written}/${p.planned}`);
  console.log("");
  console.log(`Next ${report.nextUp.length} in queue:`);
  for (const b of report.nextUp)
    console.log(`  P${b.priority} ${b.difficulty.padEnd(12)} ${b.id}`);
  if (written.size === 0 && readdirSync(ARTICLES_DIR).length === 0)
    console.log("(no articles yet)");
}
