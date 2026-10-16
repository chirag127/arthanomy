import { readFileSync, writeFileSync } from 'node:fs';

// 1) generator source: num(id,label,def,extra) was called with 'currency' in the def slot for xirr amounts
const gp = 'scripts/calc-defs/a-returns.mjs';
let g = readFileSync(gp, 'utf8');
const before = g;
g = g.replaceAll(/, 'currency', (-?\d+), \{ unit: '[\u20b9?]' \}\)/g, (_m, n) => `, ${n}, { unit: '\u20b9' })`);
writeFileSync(gp, g);
console.log('generator changed:', g !== before);

// 2) canonical data
const dp = 'src/data/calculators/definitions.json';
const d = JSON.parse(readFileSync(dp, 'utf8'));
const x = d.find((c) => c.id === 'xirr');
const fixes = { amount1: -100000, amount2: -100000, amount3: 150000, amount4: 120000 };
for (const i of x.inputs) {
  if (fixes[i.id] !== undefined) {
    i.default = fixes[i.id];
    i.unit = '\u20b9';
  }
}
writeFileSync(dp, JSON.stringify(d, null, 2) + '\n');
console.log('xirr defaults:', x.inputs.map((i) => i.id + '=' + i.default).join(', '));
