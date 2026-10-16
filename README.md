# Arthanomy — The Science of Wealth

> A source-driven Indian investment, taxation and wealth intelligence library. Understand every asset, quantify every risk, and see what you actually keep after taxes, fees and inflation.

[![Astro](https://img.shields.io/badge/Astro-7.4.0-FF5D01?logo=astro)](https://astro.build)
[![License: MIT](https://img.shields.io/badge/code-MIT-blue.svg)](./LICENSE)
[![Content: CC BY-NC-SA 4.0](https://img.shields.io/badge/content-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
![Coverage](https://img.shields.io/badge/articles-129%2F656-informational)
![Tests](https://img.shields.io/badge/tests-114%20passing-brightgreen)

## What it is

Arthanomy documents every legally accessible Indian investment avenue — from treasury bills to venture capital — against **primary sources** (RBI, SEBI, CBDT, exchanges, statutes, academic papers), prices each after tax, fees and inflation, and shows the arithmetic. Where the evidence is thin, the site says so.

**Live:** https://chirag127.github.io/arthanomy/

**Everything here is independent educational research — not investment, tax, legal or accounting advice.** The author is not a registered investment adviser.

## Key features

- **129 published articles** across 21 ordered learning series (656 planned briefs, all public on the roadmap).
- **74 unit-tested calculators** — SIP, CAGR, XIRR, post-tax return, Monte Carlo, EMI, and more — each returning "not available" rather than a fabricated number when an input is undefined.
- **Four-lane return separation** on every high-return discussion: historical realised · contractual yield · model-estimated · speculative upside — never blurred.
- **Comparison engine** that refuses to rank incomparable metrics and flags where a comparison is illegitimate.
- **Versioned tax-rule registry** plus a tax-comparison calculator; every tax figure carries an effective date and a verification date.
- **Fraud & investor-protection section** — evidence-based, no operational wrongdoing instructions.
- **Reading progress** (per-series checkboxes, local only), **glossary** (462 terms), **source registry**, **roadmap** with public queue status.
- **JSON API** (`/data/articles.json`, `/data/articles/<id>.json`) and **LLM-friendly text** (`/llms.txt`, `/llms-full.txt`).
- **CMD+K command palette**, table of contents, reading-progress bar, dark/light themes, reduced-motion support.
- **Honest coverage counters** — the gap (briefs planned vs published) is always visible.

## Stack

Astro 7.4.0 · TypeScript (strict) · MDX · React 19 islands · Tailwind CSS 4.3 · KaTeX · Mermaid · ECharts 6 · D3 · TanStack Table 9 (legacy) · Pagefind 1.5 · Shiki · Vitest 5 · Playwright 1.64 · ESLint 10 · Prettier 3.9 · GitHub Actions.

Static output only — no backend, no database. Deployed to GitHub Pages under the base path `/arthanomy`.

## Getting started

```powershell
git clone https://github.com/chirag127/arthanomy.git
cd arthanomy
npm install
npm run dev          # http://localhost:4321/arthanomy
```

Node \(\geq\) 22.12 required.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | `astro build` + Pagefind indexing (static output) |
| `npm run preview` | Preview the built site |
| `npm run lint` | ESLint over the repo |
| `npm run tsc` | `astro sync` is `astro sync`; use `npx tsc --noEmit` |
| `npm run test` | Vitest unit suite (114 tests) |
| `npm run test:e2e` | Playwright e2e + a11y |
| `npm run validate:content` | Registry shapes |
| `npm run content:status` | Queue status per series and priority |
| `npm run content:audit` | Static article audit (blocking in CI) |
| `npm run content:links` | Queued-article link audit |
| `npm run validate:links` | Built-link audit (run after `build`) |

For the full content-pipeline workflow see [`pipeline/WRITER-CONTRACT.md`](./pipeline/WRITER-CONTRACT.md).

## Quality gates (CI)

Every push to `main` runs:

1. `npx astro sync` (generates content types)
2. `npx eslint .`
3. `npx tsc --noEmit`
4. `npx vitest run`
5. `npm run validate:content`
6. `node scripts/content-pipeline/batches.mjs --check` (planned vs written counts)
7. `node scripts/content-pipeline/link-queued.mjs --check`
8. `node scripts/content-pipeline/audit-articles.mjs`
9. `npm run build` (astro + pagefind)
10. `node scripts/audit-internal-links/index.mjs` (against `dist/`)
11. Deploy to GitHub Pages (with concurrency control; a failed run preserves the last successful deploy)

## Content pipeline

656 briefs drive everything. The pipeline is resumable, queue-based and manifest-driven:

```powershell
npm run content:status          # what's written, what's queued
npm run content:batches         # batch plans (priority-ordered, 5 briefs each)
npm run content:packets         # export per-brief packets (the only writer input)
npm run content:links           # rewrite links to unpublished briefs → /roadmap#brief-<id>
npm run content:audit           # static quality gate
npm run content:plan --check    # verify readingOrder / plannedCount consistency
```

Each brief's packet carries its allowed sources, glossary terms, calculators, tax rules and word target. Writers may cite *only* what their packet allows, and the audit rejects anything outside it.

## Author & funding

**Chirag Singhal** · chirag@oriz.in · https://www.facebook.com/singhal127 · https://buymeacoffee.com/chirag127

One named accountable author. Independent research, funded by readers — no brokerage, no distributor, no sponsored placements, no data harvesting. Editorial independence policy in [`docs/editorial-policy.md`](./docs/editorial-policy.md).

## Research rules

- Primary / official sources first; record research date + effective date on every figure.
- Never fabricate citations, data, or performance claims.
- Classify source quality (primary-official, academic, secondary).
- Flag unverified claims explicitly; distinguish historical vs current product availability.
- Tax figures come only from the versioned `tax-rules` registry, with the non-`verified` rules marked provisional.

## Folder map

```
src/
  content/articles/     MDX articles (flat, filename == brief id)
  data/                 registries (briefs, series, sources, glossary, calculators, tax rules, assets)
  pages/                Astro routes
  components/           Astro + React islands
  content.config.ts     nine collections
scripts/
  content-pipeline/     queue, packets, batches, audit, reading-order
  audit-internal-links/
public/
pipeline/
  WRITER-CONTRACT.md    binding article spec
  research/             verification notes
docs/
  decisions.md         durable decisions
  corrections-log.md   things we corrected in public
  editorial-policy.md
```

## Reporting issues & corrections

Found an error or outdated figure? [Open a correction request](https://github.com/chirag127/arthanomy/issues/new?template=correction.md) — corrections are logged publicly and the article's `updated` date is revised. Bugs: [report template](https://github.com/chirag127/arthanomy/issues/new?template=bug.md).

## License

- **Code**: MIT — see [`LICENSE`](./LICENSE).
- **Original editorial content** (articles, notes, registry commentary): CC BY-NC-SA 4.0.

© 2026 Chirag Singhal.
