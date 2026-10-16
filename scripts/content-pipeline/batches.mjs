/**
 * Batch planner — splits a wave into writer-sized batches.
 *
 * Groups queued briefs (in queue order) into batches of N and prints a
 * ready-to-dispatch plan, optionally as Markdown for pasting into a writer
 * prompt. Also writes the batch assignment file so the wave is reproducible.
 *
 *   node scripts/content-pipeline/batches.mjs --priority 2 --size 5
 *   node scripts/content-pipeline/batches.mjs --series debt-encyclopedia --size 5 --out pipeline/batches/p2.md
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildContext,
  queueOrder,
  selectBriefs,
  publishedIds,
  arg,
  ROOT,
} from "./lib.mjs";

const size = Number(arg("size", 5)) || 5;
const out = arg("out", null);
const format = arg("format", out ? "md" : "text");

const ctx = buildContext();
const written = publishedIds();
const selected = selectBriefs(ctx.briefs, {
  ids: String(arg("ids", "") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  series: arg("series", null) || undefined,
  category: arg("category", null) || undefined,
  priority: arg("priority", null) ? Number(arg("priority", null)) : undefined,
});

const queue = queueOrder(
  selected,
  arg("include-written", false) ? new Set() : written,
);
const limit = Number(arg("limit", 0)) || 0;
const list = limit ? queue.slice(0, limit) : queue;

const batches = [];
for (let i = 0; i < list.length; i += size)
  batches.push(list.slice(i, i + size));

const lines = [];
if (format === "md") {
  lines.push(
    `# Writer batches — ${list.length} briefs in ${batches.length} batches of ${size}`,
  );
  lines.push("");
  lines.push(
    `Generated ${new Date().toISOString()} from the Arthanomy content pipeline.`,
  );
  lines.push("");
  batches.forEach((batch, index) => {
    lines.push(`## Batch ${index + 1} (${batch.length} articles)`);
    lines.push("");
    for (const b of batch) lines.push(`- \`${b.id}\` — ${b.title}`);
    lines.push("");
  });
} else {
  lines.push(`${list.length} briefs in ${batches.length} batches of ${size}`);
  batches.forEach((batch, index) => {
    lines.push(`BATCH ${index + 1}: ${batch.map((b) => b.id).join(" ")}`);
  });
}

const text = lines.join("\n") + "\n";
if (out) {
  const file = resolve(ROOT, out);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text, "utf8");
  console.error(`Wrote ${out}`);
}
process.stdout.write(text);
