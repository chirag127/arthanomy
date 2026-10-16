/**
 * Article audit — static checks on every MDX article against its brief packet.
 *
 * The Astro build validates the *shape* of frontmatter. This checks the things
 * shape cannot: that an article belongs to the brief it claims, that it cites
 * only sources its packet allows, that its glossary and calculator ids resolve,
 * that derived prose is inside the word target, and that the MDX body is safe
 * (no stray braces, no raw HTML, no imports).
 *
 *   node scripts/content-pipeline/audit-articles.mjs            # audit all
 *   node scripts/content-pipeline/audit-articles.mjs --wave priority-1
 *   node scripts/content-pipeline/audit-articles.mjs --ids a,b
 *
 * Exit code 1 if any article fails, so it can gate CI.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { ARTICLES_DIR, buildContext, buildPacket, arg } from "./lib.mjs";

const ctx = buildContext();
const briefById = new Map(ctx.briefs.map((b) => [b.id, b]));
const sourceIds = new Set(ctx.sources.map((s) => s.id));
const glossaryIds = new Set(ctx.glossary.map((g) => g.id));
const calculatorIds = new Set(ctx.calculators.map((c) => c.id));

const onlyIds = String(arg("ids", "") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const wave = arg("wave", null);

let files = readdirSync(ARTICLES_DIR).filter(
  (f) => f.endsWith(".mdx") || f.endsWith(".md"),
);
if (onlyIds.length)
  files = files.filter((f) => onlyIds.includes(f.replace(/\.mdx?$/, "")));
if (wave) {
  const manifest = JSON.parse(
    readFileSync(
      resolve(ARTICLES_DIR, "..", "..", "pipeline/packets", wave, "_wave.json"),
      "utf8",
    ),
  );
  const allowed = new Set(manifest.briefIds);
  files = files.filter((f) => allowed.has(f.replace(/\.mdx?$/, "")));
}

const REQUIRED_KEYS = [
  "title",
  "description",
  "category",
  "difficulty",
  "status",
  "publishedAt",
];

/** Remove `$$...$$` and `$...$` maths so brace checks only see prose. */
const stripMath = (body) =>
  body.replace(/\$\$[\s\S]*?\$\$/g, " ").replace(/\$[^$\n]*\$/g, " ");

const results = [];

for (const file of files) {
  const id = file.replace(/\.mdx?$/, "");
  const raw = readFileSync(resolve(ARTICLES_DIR, file), "utf8");
  const errors = [];
  const warnings = [];

  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) {
    errors.push("no YAML frontmatter block");
    results.push({ id, errors, warnings, words: 0 });
    continue;
  }

  let data;
  try {
    data = parseYaml(match[1]);
  } catch (error) {
    errors.push(`frontmatter does not parse: ${error.message}`);
    results.push({ id, errors, warnings, words: 0 });
    continue;
  }

  const body = raw.slice(match[0].length);
  const words = body.trim().split(/\s+/).filter(Boolean).length;

  for (const key of REQUIRED_KEYS) {
    if (data[key] === undefined || data[key] === null || data[key] === "")
      errors.push(`missing frontmatter key: ${key}`);
  }
  if (typeof data.title === "string" && data.title.length > 140)
    errors.push(`title is ${data.title.length} chars (max 140)`);
  if (
    typeof data.description === "string" &&
    (data.description.length < 40 || data.description.length > 400)
  ) {
    errors.push(
      `description is ${data.description.length} chars (needs 40-400)`,
    );
  }

  const brief = briefById.get(id);
  if (!brief) {
    errors.push(
      "no roadmap brief with this id (file name must equal the brief id)",
    );
  } else {
    const packet = buildPacket(brief, ctx);
    if (data.category !== brief.category)
      errors.push(`category "${data.category}" != brief "${brief.category}"`);
    if (brief.series && data.series !== brief.series)
      errors.push(`series "${data.series}" != brief "${brief.series}"`);
    if (brief.seriesOrder != null && data.seriesOrder !== brief.seriesOrder) {
      errors.push(
        `seriesOrder ${data.seriesOrder} != brief ${brief.seriesOrder}`,
      );
    }
    if (data.difficulty !== brief.difficulty)
      errors.push(
        `difficulty "${data.difficulty}" != brief "${brief.difficulty}"`,
      );

    const allowedSources = new Set([
      ...packet.sources.required.map((s) => s.id),
      ...packet.sources.optional.map((s) => s.id),
    ]);
    const listed = new Set();
    for (const ref of data.sources ?? []) {
      const sid = typeof ref === "string" ? ref : ref?.id;
      listed.add(sid);
      if (!sourceIds.has(sid)) errors.push(`source id not in registry: ${sid}`);
      else if (!allowedSources.has(sid))
        errors.push(`source id not in this brief's packet: ${sid}`);
    }
    for (const s of packet.sources.required) {
      if (!listed.has(s.id)) errors.push(`required source not cited: ${s.id}`);
    }
    if (listed.size < 2) warnings.push(`only ${listed.size} source(s) cited`);

    if (words < packet.wordTarget.min)
      warnings.push(
        `${words} words is below the ${packet.wordTarget.min}-${packet.wordTarget.max} target`,
      );
    if (words > packet.wordTarget.max)
      warnings.push(
        `${words} words is above the ${packet.wordTarget.max} target`,
      );

    if (data.status !== "published")
      warnings.push(`status is "${data.status}"`);
    if (!data.publishedAt) errors.push("missing publishedAt");
  }

  for (const term of data.glossaryTerms ?? []) {
    if (!glossaryIds.has(term))
      errors.push(`glossary term not in registry: ${term}`);
  }
  const relatedCalcAllowed = new Set(
    (buildPacket(brief ?? {}, ctx).calculators ?? []).map((c) => c.id),
  );
  for (const ref of data.relatedCalculators ?? []) {
    const cid = typeof ref === "string" ? ref : ref?.id;
    if (!calculatorIds.has(cid))
      errors.push(`calculator id not in registry: ${cid}`);
    else if (brief && relatedCalcAllowed.size && !relatedCalcAllowed.has(cid)) {
      warnings.push(`calculator not in this series' list: ${cid}`);
    }
  }

  const prose = stripMath(body);
  if (/[{}]/.test(prose)) errors.push("curly brace outside maths (breaks MDX)");
  if (/<\/?[a-zA-Z][^>]*>/.test(prose.replace(/```[\s\S]*?```/g, " ")))
    errors.push("raw HTML tag in body");
  if (/^\s*(import|export)\s/m.test(body))
    errors.push("import/export statement in MDX");
  if (/\$[^$]*$/.test(prose) && (body.match(/\$/g) ?? []).length % 2 !== 0)
    errors.push("unbalanced $ delimiters");

  results.push({ id, errors, warnings, words });
}

const failed = results.filter((r) => r.errors.length);
const warned = results.filter((r) => !r.errors.length && r.warnings.length);

if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify(
      { checked: results.length, failed: failed.length, results },
      null,
      2,
    ),
  );
} else {
  console.log(
    `audit-articles: ${results.length} article(s) checked, ${failed.length} failing, ${warned.length} with warnings`,
  );
  for (const r of failed) {
    console.error(`\n  FAIL ${r.id}`);
    for (const e of r.errors) console.error(`       - ${e}`);
  }
  for (const r of warned) {
    console.log(`\n  warn ${r.id} (${r.words} words)`);
    for (const w of r.warnings) console.log(`       - ${w}`);
  }
}

process.exit(failed.length ? 1 : 0);
