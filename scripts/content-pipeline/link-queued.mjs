/**
 * Queued-link guard.
 *
 * Articles may reference other library articles in their body. While the
 * library is still being written, many of those targets are briefs that have
 * not been published yet — so a raw `/library/<id>` link would 404.
 *
 * This script rewrites such links to the roadmap entry for that brief, which
 * states exactly what the article will cover. Links to published articles are
 * left untouched. Idempotent.
 *
 *   node scripts/content-pipeline/link-queued.mjs           # rewrite
 *   node scripts/content-pipeline/link-queued.mjs --check   # report only, exit 1 if any remain
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ARTICLES_DIR, loadBriefs, publishedIds, arg } from "./lib.mjs";

const check = arg("check", false);
const briefIds = new Set(loadBriefs().map((b) => b.id));
const written = publishedIds();

const files = readdirSync(ARTICLES_DIR).filter(
  (f) => f.endsWith(".mdx") || f.endsWith(".md"),
);
const linkRe = /\]\((\/library\/)([a-z0-9-]+)\)/g;

let rewritten = 0;
const leftovers = [];

for (const file of files) {
  const full = resolve(ARTICLES_DIR, file);
  const before = readFileSync(full, "utf8");
  const after = before.replace(linkRe, (match, prefix, id) => {
    if (written.has(id) || !briefIds.has(id)) return match;
    rewritten += 1;
    return `](/roadmap#brief-${id})`;
  });
  if (after !== before) {
    if (check) leftovers.push(file);
    else writeFileSync(full, after, "utf8");
  }
}

if (check) {
  if (leftovers.length) {
    console.error(
      `link-queued: ${leftovers.length} article(s) still link to unpublished briefs:`,
    );
    for (const f of leftovers.slice(0, 20)) console.error("  " + f);
    process.exit(1);
  }
  console.log("link-queued: no dead queued-article links.");
} else {
  console.log(
    `link-queued: rewrote ${rewritten} link(s) pointing at unpublished briefs.`,
  );
}
