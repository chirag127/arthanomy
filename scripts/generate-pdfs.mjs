/**
 * Generate PDFs (per article + combined book) using Playwright + Chromium.
 *
 * Run locally:
 *   npm run build && npx playwright install chromium && npm run pdf
 *
 * Output:
 *   public/downloads/articles/<id>.pdf   — one per article (via /library/<id>/ print CSS)
 *   public/downloads/arthanomy-book.pdf   — all articles (via /print/book/)
 *
 * Heavy output — NOT wired into prebuild/CI. Run manually or add to a scheduled release job.
 */
import { chromium } from 'playwright';
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/downloads');
const PER = resolve(OUT, 'articles');
const BASE = process.env.BASE_URL ?? 'http://localhost:4321/arthanomy';

mkdirSync(OUT, { recursive: true });
mkdirSync(PER, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

// Combined book PDF
console.log('printing combined book...');
await page.goto(`${BASE}/print/book/`, { waitUntil: 'networkidle' });
await page.pdf({
  path: join(OUT, 'arthanomy-book.pdf'),
  format: 'A4',
  printBackground: true,
  margin: { top: '16mm', right: '14mm', bottom: '16mm', left: '14mm' },
});
console.log('book pdf done');

// Per-article PDFs (sample 50 max per run to avoid hours; pass MAX_ARTICLES via env)
const articlesDir = resolve(ROOT, 'src/content/articles');
const ids = readdirSync(articlesDir)
  .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
  .map((f) => f.replace(/\.mdx?$/, ''));
const limit = process.env.MAX_ARTICLES ? Number(process.env.MAX_ARTICLES) : ids.length;
console.log('printing', Math.min(limit, ids.length), 'article pdfs...');
let n = 0;
for (const id of ids.slice(0, limit)) {
  try {
    await page.goto(`${BASE}/library/${id}/`, { waitUntil: 'networkidle' });
    await page.pdf({
      path: join(PER, `${id}.pdf`),
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', right: '14mm', bottom: '16mm', left: '14mm' },
    });
    n++;
  } catch (e) {
    console.error('failed', id, e.message);
  }
}
console.log('per-article pdfs done:', n);

await context.close();
await browser.close();
console.log('pdf generation complete');
