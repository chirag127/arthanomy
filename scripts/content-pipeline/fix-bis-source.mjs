/**
 * One-off registry repair: the source id `bis-home` was overloaded.
 *
 * It correctly points at the Bank for International Settlements (research on
 * leverage, tail risk, stablecoins) and is used that way by financial-mathematics
 * and digital-assets briefs. But ten briefs about Indian gold, jewellery,
 * diamonds and construction quality were also pointed at it, because "BIS" was
 * read as the Bureau of Indian Standards.
 *
 * This script adds a correct `bis-india` source and repoints only those ten
 * briefs at it. Run with --check to inspect without writing.
 *
 *   node scripts/content-pipeline/fix-bis-source.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib.mjs';

const check = process.argv.includes('--check');

/* These ids are the gold-silver / real-estate briefs whose "BIS" is the
   Bureau of Indian Standards, not the Bank for International Settlements. */
const REASSIGN = new Set([
  'hallmarking-and-purity-assurance',
  'physical-bars-and-coins-economics',
  'jewellery-as-an-investment',
  'digital-gold-platforms-and-their-risks',
  'gold-monetisation-and-deposit-schemes',
  'storing-physical-gold-safely',
  'diamonds-and-gemstones-as-assets',
  'gold-jewellery-resale-and-exchange',
  'buying-gold-online-safely',
  'construction-quality-and-home-inspection',
]);

const registryPath = resolve(ROOT, 'src/data/sources/registry.json');
const briefsPath = resolve(ROOT, 'src/data/roadmap/briefs.json');

const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const briefs = JSON.parse(readFileSync(briefsPath, 'utf8'));

const newSource = {
  id: 'bis-india',
  title: 'Bureau of Indian Standards — Hallmarking, Quality Control Orders and Indian Standards',
  publisher: 'Bureau of Indian Standards, Ministry of Consumer Affairs, Food and Public Distribution, Government of India',
  tier: 'primary-official',
  url: 'https://www.bis.gov.in/hallmarking/',
  accessedAt: '2026-10-16',
  supports:
    'The Indian hallmarking regime (Hallmarking Regulation 2018, Mandatory Hallmarking Order and its dated amendments, jeweller registration, assaying and hallmarking centres), Indian Standards and Quality Control Orders, the Gold Monetisation Scheme, and the National Building Code. Page last updated 14-Sep-2026 for the Hallmarking Regulation amendment series.',
  note: 'The national standards body. Distinct from "bis-home" (Bank for International Settlements) — the two ids previously collided.',
  topic: ['gold-silver', 'real-estate', 'consumer-protection', 'standards'],
  reviewDue: '2027-02-15',
};

let added = 0;
if (!registry.some((s) => s.id === 'bis-india')) {
  const at = registry.findIndex((s) => s.id === 'bis-home');
  registry.splice(at + 1, 0, newSource);
  added = 1;
}

const changed = [];
for (const brief of briefs) {
  if (!REASSIGN.has(brief.id)) continue;
  const idx = brief.requiredSources.indexOf('bis-home');
  if (idx === -1) continue;
  brief.requiredSources[idx] = 'bis-india';
  changed.push(brief.id);
}

console.log(`${check ? '[check] ' : ''}added bis-india: ${added === 1}; briefs repointed: ${changed.length}`);
for (const id of changed) console.log('  ' + id);

if (check) process.exit(0);

if (added) writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
if (changed.length) writeFileSync(briefsPath, JSON.stringify(briefs, null, 2) + '\n', 'utf8');
