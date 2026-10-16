/**
 * Generates a downloadable book of every published article (+per-article text).
 *
 * Output:
 *   public/downloads/arthanomy-book.md   — full markdown assembly, reading-order
 *   public/downloads/arthanomy-book.txt   — TTS-friendly plain text
 *   public/downloads/articles/<id>.md     — per-article (markdown)
 *   public/downloads/articles/<id>.txt    — per-article (plain text)
 *   public/downloads/manifest.json        — list of files with counts
 *
 * Run: node scripts/generate-book.mjs (also invoked as prebuild).
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLES_DIR = resolve(ROOT, 'src/content/articles');
const OUT_DIR = resolve(ROOT, 'public/downloads');
const PER_DIR = resolve(OUT_DIR, 'articles');

function readJson(rel) {
  return JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));
}

const briefs = readJson('src/data/roadmap/briefs.json');
const series = readJson('src/data/series/series.json');
const briefById = new Map(briefs.map((b) => [b.id, b]));

// Define a stable reading order across the corpus: by series readingOrder, then by
// standalone published articles that have no series (alphabetical).
const publishedFiles = readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.mdx') || f.endsWith('.md'));
const published = new Map();
for (const f of publishedFiles) {
  const id = f.replace(/\.mdx?$/, '');
  published.set(id, readFileSync(join(ARTICLES_DIR, f), 'utf8'));
}

const seriesOrdered = series
  .filter((s) => Array.isArray(s.readingOrder))
  .sort((a, b) => a.order - b.order);

const orderedIds = [];
const used = new Set();
for (const s of seriesOrdered) {
  for (const id of s.readingOrder || []) {
    if (published.has(id) && !used.has(id)) {
      orderedIds.push(id);
      used.add(id);
    }
  }
}
// append any published article not in a series reading order, alphabetical
const rest = [...published.keys()]
  .filter((id) => !used.has(id))
  .sort();
for (const id of rest) orderedIds.push(id);

function splitFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: raw };
  const fm = m[1];
  // extract a few keys by best effort without a YAML dep
  const get = (k) => {
    const re = new RegExp(`^${k}:\\s*["']?(.*?)["']?\\s*$`, 'm');
    const match = fm.match(re);
    return match ? match[1].trim() : null;
  };
  return {
    data: {
      title: get('title'),
      description: get('description'),
      difficulty: get('difficulty'),
      series: get('series'),
      readingMinutes: get('readingMinutes'),
    },
    body: raw.slice(m[0].length),
  };
}

function toPlainText(md) {
  let t = md;
  // drop code fences content markers but keep code lines readable
  t = t.replace(/```[\s\S]*?```/g, '');
  // math: keep a flat readable version of $$...$$, strip backslashes/braces
  t = t.replace(
    /\$\$([\s\S]*?)\$\$/g,
    (_, m) =>
      ' [equation: ' +
      m
        .replace(/\\[a-zA-Z]+/g, '')
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim() +
      '] ',
  );
  t = t.replace(/\$[^$\n]*\$/g, ' [expression] ');
  // headings -> blank line + Title Case underline-friendly
  t = t.replace(/^#{1,6}\s+/gm, '\n');
  // bold/italic emphasis -> text
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1');
  t = t.replace(/\*([^*]+)\*/g, '$1');
  // inline code
  t = t.replace(/`([^`]*)`/g, '$1');
  // links -> text (keep url in parens)
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  // bullets -> spoken list marker
  t = t.replace(/^\s*[-*]\s+/gm, '  - ');
  // collapse 3+ blank lines
  t = t.replace(/\n{4,}/g, '\n\n\n');
  // trim trailing spaces
  t = t.replace(/[ \t]+\n/g, '\n');
  return t.trim();
}

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(PER_DIR, { recursive: true });

// clean old generated article files
for (const f of readdirSync(PER_DIR)) {
  if (f.endsWith('.md') || f.endsWith('.txt')) {
    // best-effort remove only stale ones; keep if regenerated below
  }
}

const fullMdLines = [];
const fullTxtSections = [];

fullMdLines.push('# Arthanomy — The Science of Wealth');
fullMdLines.push('');
fullMdLines.push(
  '_A source-driven Indian investment, taxation and wealth intelligence library. ' +
    'Reading every published article, in the order recommended by the learning paths._',
);
fullMdLines.push('');
fullMdLines.push('---');
fullMdLines.push('');

const nonMdEmpty = orderedIds.filter((id) => published.has(id));

let wordCount = 0;

for (const id of nonMdEmpty) {
  const raw = published.get(id);
  const { data, body } = splitFrontmatter(raw);
  const title = data.title || id.replace(/-/g, ' ');
  wordCount += body.trim().split(/\s+/).filter(Boolean).length;

  // per-article files
  const perMd =
    `# ${title}\n\n` +
    (data.description ? `${data.description}\n\n` : '') +
    `Difficulty: ${data.difficulty || ''} · Series: ${data.series || ''} ` +
    (data.readingMinutes ? `· ${data.readingMinutes} min read\n\n` : '\n\n') +
    body.trim() +
    '\n';
  const perTxt = (title + '\n' + '='.repeat(title.length) + '\n\n' + (data.description ? data.description + '\n\n' : '') + toPlainText(body) + '\n');
  writeFileSync(join(PER_DIR, id + '.md'), perMd, 'utf8');
  writeFileSync(join(PER_DIR, id + '.txt'), perTxt, 'utf8');

  // combined
  fullMdLines.push(`# ${title}`);
  if (data.description) fullMdLines.push(`_${data.description}_`);
  fullMdLines.push('');
  fullMdLines.push(body.trim());
  fullMdLines.push('');
  fullMdLines.push('---');
  fullMdLines.push('');

  fullTxtSections.push(
    title + '\n' + '='.repeat(Math.min(title.length, 60)) + '\n\n' + (data.description ? data.description + '\n\n' : '') + toPlainText(body),
  );
}

const combinedMd = fullMdLines.join('\n');
const combinedTxt =
  'ARTHANOMY — THE SCIENCE OF WEALTH\n' +
  'The Science of Wealth. The Reality of Risk.\n\n' +
  'Everything published on the site to date, in the recommended reading order. ' +
  'Plain-text rendering is optimised for text-to-speech (short sentences, spoken lists, ' +
  'equation headers in brackets). Equations appear as "[equation: ...]".\n\n' +
  'TOTAL ARTICLES: ' +
  nonMdEmpty.length +
  '\n\n' +
  '=== SECTION INDEX ===\n' +
  nonMdEmpty
    .map((id, i) => {
      const { data } = splitFrontmatter(published.get(id));
      return (i + 1 + '. ' + (data.title || id)).trim();
    })
    .join('\n') +
  '\n\n' +
  fullTxtSections.join('\n\n' + '='.repeat(60) + '\n\n');

writeFileSync(resolve(OUT_DIR, 'arthanomy-book.md'), combinedMd, 'utf8');
writeFileSync(resolve(OUT_DIR, 'arthanomy-book.txt'), combinedTxt, 'utf8');

const manifest = {
  generatedAt: new Date().toISOString(),
  articles: nonMdEmpty.length,
  words: wordCount,
  files: [
    'arthanomy-book.md',
    'arthanomy-book.txt',
    'articles/*.{md,txt}',
  ],
};
writeFileSync(resolve(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log(
  `generate-book: ${nonMdEmpty.length} articles, ${wordCount} words -> ${OUT_DIR}`,
);
