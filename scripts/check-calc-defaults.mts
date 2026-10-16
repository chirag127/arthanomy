/**
 * check-calc-defaults — reports which calculators produce no meaningful
 * output with their own default inputs (all values null/empty).
 * Run: npx vite-node scripts/check-calc-defaults.mts
 */
import { compute } from '../src/lib/calculators/index';
import definitions from '../src/data/calculators/definitions.json' with { type: 'json' };

const empty: string[] = [];
for (const def of definitions) {
  const values: Record<string, unknown> = {};
  for (const input of def.inputs) values[input.id] = input.default;
  const result = compute(def.id, values as never);
  if (!result || result.outputs.length === 0) {
    empty.push(`${def.id} :: missing result`);
    continue;
  }
  const meaningful = result.outputs.some((o) => o.value !== null && o.value !== undefined && o.value !== '');
  if (!meaningful) empty.push(`${def.id} :: ${result.outputs.map((o) => o.label).join(' / ')}`);
}
console.log(`total ${definitions.length}; unhelpful defaults: ${empty.length}`);
for (const line of empty) console.log('  ' + line);
