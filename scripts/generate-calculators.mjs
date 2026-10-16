/**
 * Combines the calculator definition batches into a single collection file and
 * validates the result before writing it.
 *
 * Run: node scripts/generate-calculators.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import aReturns from './calc-defs/a-returns.mjs';
import bFixedIncome from './calc-defs/b-fixed-income.mjs';
import cPlanning from './calc-defs/c-planning.mjs';
import dTaxProperty from './calc-defs/d-tax-property.mjs';
import eDerivatives from './calc-defs/e-derivatives.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '../src/data/calculators/definitions.json');

const CATEGORIES = [
  'returns',
  'planning',
  'debt',
  'fixed-income',
  'portfolio',
  'risk',
  'real-estate',
  'alternatives',
  'tax',
  'derivatives',
];
const DIFFICULTIES = ['foundational', 'intermediate', 'advanced', 'expert'];
const KINDS = ['currency', 'percent', 'number', 'years', 'date', 'select', 'toggle'];

const all = [...aReturns, ...bFixedIncome, ...cPlanning, ...dTaxProperty, ...eDerivatives];

const errors = [];
const ids = new Set();

for (const calc of all) {
  if (ids.has(calc.id)) errors.push(`Duplicate calculator id: ${calc.id}`);
  ids.add(calc.id);
  if (!CATEGORIES.includes(calc.category)) errors.push(`${calc.id}: bad category ${calc.category}`);
  if (!DIFFICULTIES.includes(calc.difficulty)) errors.push(`${calc.id}: bad difficulty ${calc.difficulty}`);
  if (!calc.name || calc.name.length > 60) errors.push(`${calc.id}: name missing or too long`);
  if (!calc.shortDescription || calc.shortDescription.length < 40) {
    errors.push(`${calc.id}: shortDescription too short`);
  }
  if (!Array.isArray(calc.inputs) || calc.inputs.length === 0) errors.push(`${calc.id}: no inputs`);
  const inputIds = new Set();
  for (const input of calc.inputs ?? []) {
    if (inputIds.has(input.id)) errors.push(`${calc.id}: duplicate input id ${input.id}`);
    inputIds.add(input.id);
    if (!KINDS.includes(input.kind)) errors.push(`${calc.id}/${input.id}: bad kind ${input.kind}`);
    if (!('default' in input)) errors.push(`${calc.id}/${input.id}: no default`);
    const d = input.default;
    if (!['number', 'string', 'boolean'].includes(typeof d)) {
      errors.push(`${calc.id}/${input.id}: default type ${typeof d}`);
    }
    if (input.kind === 'select' && !Array.isArray(input.options)) {
      errors.push(`${calc.id}/${input.id}: select without options`);
    }
  }
  if (!Array.isArray(calc.limitations) || calc.limitations.length === 0) {
    errors.push(`${calc.id}: no limitations (every calculator must state at least one)`);
  }
  if (!calc.engine) errors.push(`${calc.id}: no engine key`);
}

// Every cross-reference must resolve.
for (const calc of all) {
  for (const ref of calc.relatedCalculators ?? []) {
    if (!ids.has(ref)) errors.push(`${calc.id}: relatedCalculators references unknown id ${ref}`);
  }
}

if (errors.length > 0) {
  console.error(`FAILED with ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(all, null, 2)}\n`, 'utf8');

const byCategory = {};
const byDifficulty = {};
for (const c of all) {
  byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
  byDifficulty[c.difficulty] = (byDifficulty[c.difficulty] ?? 0) + 1;
}

console.log(`Wrote ${all.length} calculator definitions to ${outPath}`);
console.log('By category:', byCategory);
console.log('By difficulty:', byDifficulty);
