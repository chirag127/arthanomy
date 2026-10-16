/**
 * Packet exporter — turns queued briefs into per-wave work packets.
 *
 * Each packet is a self-contained JSON file: the brief, the closed set of
 * source/glossary/calculator ids it may cite, the word target and the target
 * file path. A packet is the contract a writer works from.
 *
 * Usage:
 *   node scripts/content-pipeline/export-packets.mjs --series debt-encyclopedia
 *   node scripts/content-pipeline/export-packets.mjs --priority 1 --limit 20
 *   node scripts/content-pipeline/export-packets.mjs --ids a,b,c --out pipeline/packets/wave-01
 *   node scripts/content-pipeline/export-packets.mjs --priority 1 --dry-run
 *
 * Defaults to the queue order (priority, then series) and skips briefs that
 * already have an MDX file, so re-running is safe and resumable.
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildContext,
  buildPacket,
  queueOrder,
  selectBriefs,
  publishedIds,
  arg,
  ROOT,
  PACKETS_DIR,
} from "./lib.mjs";

const ids = String(arg("ids", "") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const series = arg("series", null);
const category = arg("category", null);
const priority = arg("priority", null);
const limit = Number(arg("limit", 0)) || 0;
const dryRun = arg("dry-run", false);
const includeWritten = arg("include-written", false);
const out = arg("out", null);

const ctx = buildContext();
const written = publishedIds();

let list = selectBriefs(ctx.briefs, {
  ids,
  series: series || undefined,
  category: category || undefined,
  priority: priority ? Number(priority) : undefined,
});
if (!includeWritten && !ids.length)
  list = list.filter((b) => !written.has(b.id));

// Deterministic order even for explicit selections.
list = queueOrder(list, new Set());

if (limit) list = list.slice(0, limit);

if (!list.length) {
  console.error(
    "No briefs selected. Try --series <id>, --priority <1-5>, --ids a,b.",
  );
  process.exit(1);
}

const packets = list.map((b) => buildPacket(b, ctx));

// Group packets into a single wave manifest + one file per packet.
const waveName =
  out ||
  (series
    ? `series-${series}`
    : priority
      ? `priority-${priority}`
      : ids.length
        ? "selection"
        : "queue");
const waveDir = resolve(ROOT, out ? out : `pipeline/packets/${waveName}`);

if (dryRun) {
  console.log(`DRY RUN — would write ${packets.length} packets to ${waveDir}`);
  for (const p of packets.slice(0, 5)) {
    console.log("");
    console.log(`  ${p.brief.id}`);
    console.log(
      `    series: ${p.series ? p.series.title + " #" + p.brief.seriesOrder : "(none)"}  difficulty: ${p.brief.difficulty}  words: ${p.wordTarget.min}-${p.wordTarget.max}`,
    );
    console.log(
      `    required sources: ${p.sources.required.map((s) => s.id).join(", ") || "(none)"}`,
    );
    console.log(
      `    optional sources: ${p.sources.optional.length}, glossary: ${p.glossaryTerms.length}, calculators: ${p.calculators.length}`,
    );
    console.log(`    -> ${p.target.path}`);
  }
  if (packets.length > 5) console.log(`\n  ... and ${packets.length - 5} more`);
  process.exit(0);
}

if (existsSync(waveDir) && !arg("append", false))
  rmSync(waveDir, { recursive: true, force: true });
mkdirSync(waveDir, { recursive: true });

for (const p of packets) {
  writeFileSync(
    resolve(waveDir, `${p.brief.id}.json`),
    JSON.stringify(p, null, 2) + "\n",
    "utf8",
  );
}

const manifest = {
  wave: waveName,
  exportedAt: new Date().toISOString(),
  count: packets.length,
  briefIds: packets.map((p) => p.brief.id),
  packets: packets.map((p) => ({
    id: p.brief.id,
    title: p.brief.title,
    series: p.brief.series,
    difficulty: p.brief.difficulty,
    words: p.wordTarget,
    path: p.target.path,
  })),
};
writeFileSync(
  resolve(waveDir, "_wave.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8",
);

console.log(
  `Exported ${packets.length} packets to ${waveDir.replace(ROOT + "\\", "").replace(ROOT + "/", "")}`,
);
console.log(`Wave manifest: ${resolve(waveDir, "_wave.json")}`);
