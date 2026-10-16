# Arthanomy writer contract

One article = one packet (`pipeline/packets/<wave>/<brief-id>.json`) + one MDX file.
This document is the whole specification. Follow it exactly; the build fails on
schema violations, and a failed build blocks deploys for the entire site.

## 1. Output file

Write **exactly one** file:

    src/content/articles/<brief.id>.mdx

- The file name must equal `brief.id` from the packet. Flat directory, no subfolders.
- The route is `/library/<brief.id>`; wrong file names produce broken links.
- Never write a file for a brief that is not in your packet. Never edit existing
  articles, registries, pages or scripts.
- If the file already exists, leave it alone (a human may have edited it).

## 2. Hard rules (non-negotiable)

1. **No fabrication.** Do not invent statistics, prices, returns, dates, scheme
   names, company figures, regulatory numbers or quotations. Every factual claim
   must be supported by a source in `packet.sources.required` or
   `packet.sources.optional`, or by `packet.taxRules` for tax pieces.
2. **Cite only packet source ids.** Using an id outside the packet breaks the
   source registry contract.
3. **Label arithmetic.** Any number you derive yourself must be introduced as an
   illustrative calculation (e.g. "an illustrative calculation, not a forecast:").
   Never present a derived number as observed performance.
4. **Separate the four lanes** where a return is discussed: historical realised /
   contractual / model-estimated / speculative. Never blend them silently.
5. **Tax content** may restate only what `packet.taxRules` (and the cited
   official sources) state. If the Finance Act 2025 section renumbering is
   relevant, say it is pending verification. Mark tax rules whose
   `reviewStatus` is not `verified` as provisional.
6. **No operational wrongdoing.** In fraud/illegal-finance articles, explain
   how schemes work and how to detect them — never step-by-step instructions to
   deceive, launder, or evade.
7. **Educational, not advisory.** No personalised recommendations, no "you
   should buy", no performance promises. No invented author credentials or
   testimonials.
8. **MDX safety.** Curly braces `{` `}` start a JSX expression in MDX. Use them
   **only** inside `$$ ... $$` maths. Never write raw HTML tags in the body
   (no `<div>`, `<span>`, `<br>`). No `import`/`export` statements.

## 3. Frontmatter (exact shape)

Required: `title`, `description`, `category`, `difficulty`, `status`,
`publishedAt`. Everything else below is strongly expected and validated.

```yaml
---
title: "Anatomy of a Bank Fixed Deposit: Rate, Compounding and Exit Rules" # <=140 chars, no colon problems -> quote it
description: "What a fixed-deposit rate actually yields once compounding, premature-withdrawal penalties and joint-holder rules are accounted for, and how to compare two offers on genuinely equivalent terms." # 40-400 chars
shortTitle: "Anatomy of a Bank Fixed Deposit" # <=80 chars
category: debt # must equal brief.category
series: debt-encyclopedia # must equal brief.series (omit if packet.series is null)
seriesOrder: 1 # must equal brief.seriesOrder
topics: ["fixed deposits", "compounding", "premature withdrawal"]
tags: ["banking", "debt", "deposit-insurance"]
difficulty: foundational # must equal brief.difficulty
status: published
kind: explainer # research | reference | explainer | case-study | comparison
publishedAt: 2026-10-16
researchDate: 2026-10-16
reviewedAt: 2026-10-16
readingMinutes: 12
keyTakeaways:
  - "A fixed-deposit rate is nominal; the compounding convention decides what it actually earns."
  - "Premature withdrawal typically costs principal interest, not just future interest."
  - "Deposit insurance covers a stated limit per depositor per bank — above it you are an unsecured creditor."
faqs:
  - question: "Why is the advertised rate not what I earn?"
    answer: "Because the rate is quoted for a compounding convention and period; quarterly compounding, TDS and premature-withdrawal penalties all change the realised number."
relatedCalculators:
  - { id: fd, label: "Fixed Deposit Calculator" }
relatedArticles:
  - treasury-bills-as-the-risk-free-anchor
glossaryTerms: [compounding, nominal-return, deposit-insurance]
sources:
  - {
      id: rbi-fd-rates,
      supports: "Basis on which deposit rates and compounding conventions are set and reported",
    }
  - {
      id: dicgc,
      supports: "Deposit-insurance cover limit and the claim mechanism for bank deposits",
    }
dataConfidence: high
hasPlainEnglish: true
hasWorkedExample: true
warnings:
  - "Rates quoted are illustrative examples of structure, not offers available from any bank."
applicablePeriods: ["FY 2025-26", "AY 2026-27"]
openQuestions:
  - "How much of the spread between small-finance-bank and large-bank deposit rates compensates for genuine credit risk?"
---
```

### Field rules

- `title` ≤ 140 characters. `description` 40–400 characters. Quote any string
  containing `:` or starting with a quote/special character.
- `category`, `series`, `difficulty`, `seriesOrder` must match the brief exactly.
  Allowed `category` values: investment-basics, equity, mutual-funds, debt,
  p2p-lending, gold-silver, real-estate, reits-invits, derivatives,
  private-markets, agriculture, insurance-pensions, international,
  digital-assets, taxation, asset-allocation, portfolio-operations,
  financial-system, financial-mathematics, fraud-risk.
- `kind`: research | reference | explainer | case-study | comparison.
- `status` must be `published` (articles appear in the library only when complete).
- `publishedAt` = `2026-10-16` unless the packet says otherwise.
- `readingMinutes` = round(body word count / 200).
- `keyTakeaways`: 4–7 items, each a full sentence with a claim.
- `faqs`: 3–6 items, each `{ question, answer }`; answers 1–3 sentences.
- `relatedCalculators`: use **only** `packet.calculators[].id`. 0–5 entries.
- `relatedArticles`: 2–6 ids — use `packet.relatedBriefs[].id` (links may point to
  still-planned articles; that is expected and the roadmap marks them "queued").
- `glossaryTerms`: use **only** `packet.glossaryTerms[].id`.
- `sources`: 2–8 entries; include every `packet.sources.required` id, and use
  `supports` to state truthfully what that source backs **in this article**.
- `dataConfidence`: high | medium | low | unavailable — be honest.
- Set `hasPlainEnglish: true` when you include an "Explain simply" section;
  `hasWorkedExample: true` when you include a worked example; `hasDiagram: true`
  only if the body includes a ```mermaid fenced block.
- `applicablePeriods`, `warnings`, `openQuestions` are optional arrays — use them
  for tax/regulatory/review-status items.

## 4. Body

- Length: within `packet.wordTarget` (words in the body, excluding frontmatter).
- Structure: short opening paragraph (no heading), then `##` sections. Use `###`
  sparingly. Aim for 6–12 `##` sections.
- Required sections when applicable:
  - `## Explain simply` — a 3–6 sentence plain-language paragraph (advanced
    material must have this).
  - `## Worked example` — one concrete, clearly-labelled illustrative calculation.
  - `## What this does not tell you` / limitations.
  - `## Open questions` — echo the brief's unresolved issues.
- Markdown allowed: paragraphs, `-`/`1.` lists, tables, blockquotes (`>`),
  `**bold**`, `*italic*`, inline `` `code` ``, links to internal routes via
  `/library/<id>` style paths (the build rewrites the base path), and fenced
  code blocks. Tables are good for comparisons.
- Maths: `$$ ... $$` display or `$ ... $` inline; KaTeX is configured with
  `throwOnError: false`.
- Optional diagram: a ```mermaid fenced block with `graph TD` / `graph LR`.
  Keep node labels short and free of parentheses.
- Voice: precise, calm, evidence-first; British/Indian English; no hype, no
  exclamation marks, no emoji, no second-person sales pitch. Explain jargon on
  first use. The author is **Chirag Singhal** — never invent other authors,
  credentials, or testimonials.
- Do not write a "Sources" or "References" list in the body — the layout renders
  `sources` from the frontmatter automatically.

## 5. Do not

- Do not create stub or placeholder articles. If you cannot write a substantive
  article for a brief, write fewer files and report that honestly.
- Do not add `import` lines, JSX components, or raw HTML.
- Do not touch `src/data/**`, `src/pages/**`, `src/components/**`, other
  articles, `package.json`, or anything under `.github/`.
- Do not run `git commit` or `git push`. The orchestrator commits waves.
- Do not run `npm run build` (slow); the orchestrator builds after the wave.

## 6. Self-check before finishing

For each file you wrote, confirm:

- [ ] path is `src/content/articles/<brief.id>.mdx`
- [ ] frontmatter parses as YAML; all strings with `:` are quoted
- [ ] every `sources[].id` is in the packet; every required source included
- [ ] every `glossaryTerms[]` and `relatedCalculators[].id` is in the packet
- [ ] no `{` or `}` outside `$$...$$` maths; no raw HTML; no `import`
- [ ] body word count is within the packet target
- [ ] no invented figures; derived figures are labelled illustrative
- [ ] report back: number of files written, and the word count of each
