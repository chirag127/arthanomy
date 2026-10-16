#!/usr/bin/env node
/**
 * audit-internal-links — verifies that every internal href/src in the built
 * site resolves to a file that actually exists in dist/.
 *
 * Handles: the /arthanomy base path, directory URLs (index.html), hash
 * fragments (checked for id presence in the target page where the target is
 * HTML), and skips external protocols.
 *
 * Exit code 1 with a list of broken links when any are found.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const BASE = '/arthanomy';

if (!existsSync(DIST)) {
  console.error('dist/ not found — run the build first.');
  process.exit(1);
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith('.html')) yield full;
  }
}

const idCache = new Map();
async function hasFragment(file, fragment) {
  if (!idCache.has(file)) {
    const html = await readFile(file, 'utf8');
    const ids = new Set();
    for (const match of html.matchAll(/id="([^"]+)"/g)) ids.add(match[1]);
    for (const match of html.matchAll(/name="([^"]+)"/g)) ids.add(match[1]);
    idCache.set(file, ids);
  }
  return idCache.get(file).has(fragment);
}

const problems = [];
let checked = 0;

for await (const file of walk(DIST)) {
  const html = await readFile(file, 'utf8');
  const url = file.slice(DIST.length).replace(/\\/g, '/');
  const urlDir = path.posix.dirname(url);

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const raw = match[1];
    if (
      raw === '' ||
      raw.startsWith('http://') ||
      raw.startsWith('https://') ||
      raw.startsWith('mailto:') ||
      raw.startsWith('tel:') ||
      raw.startsWith('data:') ||
      raw.startsWith('javascript:')
    ) {
      continue;
    }

    // Only audit links under our base path (site-internal), or relative anchors.
    let target = raw;
    if (target.startsWith(BASE)) target = target.slice(BASE.length);
    else if (!target.startsWith('/')) target = path.posix.join(urlDir, target);
    if (!target.startsWith('/')) continue;

    checked += 1;
    const [pathPart, fragment] = target.split('#');
    let resolved = path.join(DIST, pathPart);
    if (pathPart.endsWith('/') || pathPart === '' || existsSync(resolved) && (await stat(resolved)).isDirectory()) {
      resolved = path.join(resolved, 'index.html');
    }
    if (!path.extname(resolved)) resolved += '.html';

    if (!existsSync(resolved)) {
      problems.push(`${url} → ${raw} (missing ${path.relative(DIST, resolved)})`);
      continue;
    }
    if (fragment && resolved.endsWith('.html')) {
      const ok = await hasFragment(resolved, fragment);
      if (!ok) problems.push(`${url} → ${raw} (missing anchor #${fragment})`);
    }
  }
}

console.log(`audit-internal-links: checked ${checked} internal links across dist/`);
if (problems.length > 0) {
  console.error(`Found ${problems.length} broken link(s):`);
  for (const problem of problems.slice(0, 40)) console.error('  ' + problem);
  if (problems.length > 40) console.error(`  … and ${problems.length - 40} more`);
  process.exit(1);
}
console.log('All internal links resolve.');
