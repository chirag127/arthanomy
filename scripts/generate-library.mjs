/**
 * Combines the library definition batches into a single collection file.
 *
 * Run: node scripts/generate-library.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import books from './lib-defs/a-books.mjs';
import papers from './lib-defs/b-papers-official.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '../src/data/library/items.json');

const TYPES = ['book', 'paper', 'report', 'official-document', 'dataset'];
const REGIONS = ['india', 'international', 'both'];
const DIFFICULTIES = ['foundational', 'intermediate', 'advanced', 'expert'];

const all = [...books, ...papers];

const errors = [];
const ids = new Set();
for (const item of all) {
  if (ids.has(item.id)) errors.push(`Duplicate id: ${item.id}`);
  ids.add(item.id);
  if (!item.title) errors.push(`${item.id}: no title`);
  if (!Array.isArray(item.authors) || item.authors.length === 0) errors.push(`${item.id}: no authors`);
  if (!TYPES.includes(item.type)) errors.push(`${item.id}: bad type ${item.type}`);
  if (!REGIONS.includes(item.region)) errors.push(`${item.id}: bad region ${item.region}`);
  if (!DIFFICULTIES.includes(item.difficulty)) errors.push(`${item.id}: bad difficulty ${item.difficulty}`);
  if (!Array.isArray(item.subjects) || item.subjects.length === 0) errors.push(`${item.id}: no subjects`);
  if (!item.whyItMatters || item.whyItMatters.length < 80) errors.push(`${item.id}: whyItMatters too short`);
  if (!Array.isArray(item.strengths) || item.strengths.length === 0) errors.push(`${item.id}: no strengths`);
  if (!Array.isArray(item.limitations) || item.limitations.length === 0) {
    errors.push(`${item.id}: no limitations (every entry must state what it does not cover)`);
  }
  if (!Array.isArray(item.seriesIds) || item.seriesIds.length === 0) errors.push(`${item.id}: no seriesIds`);
}

if (errors.length > 0) {
  console.error(`FAILED with ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(all, null, 2)}\n`, 'utf8');

const byType = {};
for (const i of all) byType[i.type] = (byType[i.type] ?? 0) + 1;

console.log(`Wrote ${all.length} library items to ${outPath}`);
console.log('By type:', byType);
