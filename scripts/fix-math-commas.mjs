// Strip {,} grouping commas from inline and display math in article MDX.
// Inside $$...$ and $...$, `{,}` (LaTeX digit grouping) breaks MDX/acorn parsing.
// Replacing `{,}` with a plain comma keeps the rendered output identical.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'src/content/articles';
let changed = 0;

for (const f of readdirSync(dir)) {
  if (!f.endsWith('.mdx')) continue;
  const p = join(dir, f);
  const c = readFileSync(p, 'utf8');
  const out = c
    .replace(/\$\$[\s\S]*?\$\$/g, (m) => m.replace(/\{,\}/g, ','))
    .replace(/\$[^$\n]*\$/g, (m) => m.replace(/\{,\}/g, ','));
  if (out !== c) {
    writeFileSync(p, out);
    console.log('fixed', f);
    changed++;
  }
}
console.log('files changed:', changed);
