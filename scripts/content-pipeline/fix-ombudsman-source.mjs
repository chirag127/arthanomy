/**
 * One-off registry repair: RB-IOS 2021 -> RB-IOS 2026.
 *
 * The RBI's own FAQ (dated 01-Jul-2026) states that the Reserve Bank – Integrated
 * Ombudsman Scheme, 2026 came into force on 1 July 2026 and replaces the 2021
 * scheme, which now governs only complaints received before that date, appeals
 * arising under it, and execution of its awards.
 *
 * The registry previously recorded the 2021 scheme as current. This script
 * replaces it with a dated `rbi-ombudsman-2026` source carrying the verified
 * mechanics, and repoints series bibliographies and article citations.
 *
 *   node scripts/content-pipeline/fix-ombudsman-source.mjs [--check]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, ARTICLES_DIR } from './lib.mjs';

const check = process.argv.includes('--check');

const registryPath = resolve(ROOT, 'src/data/sources/registry.json');
const seriesPath = resolve(ROOT, 'src/data/series/series.json');

const source = {
  id: 'rbi-ombudsman-2026',
  title: 'Reserve Bank - Integrated Ombudsman Scheme, 2026 (in force 01-Jul-2026; replaces RB-IOS, 2021)',
  publisher: 'Reserve Bank of India',
  tier: 'primary-official',
  url: 'https://www.rbi.org.in/commonperson/english/scripts/FAQs.aspx?Id=3407',
  accessedAt: '2026-10-16',
  supports:
    'The current RBI grievance-redressal framework. Coverage (banks including co-operative banks with deposit size of Rs 50 crore and above, certain NBFCs with asset size of Rs 100 crore and above or accepting deposits, non-bank prepaid-instrument issuers, credit information companies) and the major exclusions (housing finance companies, core investment companies, etc.); the requirement to approach the regulated entity first; the 30-day wait, or the higher period set by RBI, NPCI or card-network guidelines; the 90-day window to escalate measured from that deadline or from the last communication; filing through cms.rbi.org.in or the CRPC; no fee; no cap on the disputed amount, with compensation up to Rs 30 lakh for consequential loss and up to Rs 3 lakh for time, expenses and harassment; and the 30-day appeal window.',
  note: 'Replaces the 2021 scheme, which continues to govern complaints received before 01-Jul-2026 and appeals/awards arising under it. The scheme text is at rbidocs.rbi.org.in (SCHEME16012026_A.pdf); the RBI Complaints page still linked the 2021 PDF on 16-Oct-2026, so this FAQ page is the operative citation.',
  topic: ['financial-system', 'fraud-risk', 'p2p-lending', 'debt', 'regulation'],
  reviewDue: '2027-02-15',
};

const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const at = registry.findIndex((s) => s.id === 'rbi-ombudsman-2021');
if (at === -1) {
  if (!registry.some((s) => s.id === source.id)) {
    const rbiHome = registry.findIndex((s) => s.id === 'rbi-home');
    registry.splice(rbiHome + 1, 0, source);
  }
} else {
  registry[at] = source;
}

const series = JSON.parse(readFileSync(seriesPath, 'utf8'));
const seriesChanged = [];
for (const s of series) {
  const idx = s.bibliography.indexOf('rbi-ombudsman-2021');
  if (idx !== -1) {
    s.bibliography[idx] = source.id;
    seriesChanged.push(s.id);
  }
}

const articles = readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.mdx'));
const articleChanged = [];
for (const file of articles) {
  const full = resolve(ARTICLES_DIR, file);
  const before = readFileSync(full, 'utf8');
  if (!before.includes('rbi-ombudsman-2021')) continue;
  const after = before.replaceAll('rbi-ombudsman-2021', source.id);
  if (!check) writeFileSync(full, after, 'utf8');
  articleChanged.push(file);
}

console.log(`${check ? '[check] ' : ''}registry: replaced rbi-ombudsman-2021 -> ${source.id}`);
console.log(`series bibliographies updated: ${seriesChanged.join(', ') || '(none)'}`);
console.log(`articles repointed (frontmatter id only — prose naming must be revised): ${articleChanged.join(', ') || '(none)'}`);

if (check) process.exit(0);

writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
writeFileSync(seriesPath, JSON.stringify(series, null, 2) + '\n', 'utf8');
