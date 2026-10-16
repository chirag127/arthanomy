/**
 * Static JSON API — one published article in full (frontmatter + body).
 *
 * /data/articles/<id>.json
 */
import { getCollection } from 'astro:content';
import type { APIRoute, GetStaticPaths } from 'astro';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const articles = await getCollection('articles', ({ data }) => !data.draft);
  return articles.map((entry) => ({
    params: { id: entry.id.replace(/\/index$/, '') },
  }));
};

export const GET: APIRoute = async ({ params }) => {
  const articles = await getCollection('articles', ({ data }) => !data.draft);
  const entry = articles.find((a) => a.id.replace(/\/index$/, '') === params.id);
  if (!entry) return new Response('Not found', { status: 404 });

  const d = entry.data;
  const payload = {
    id: entry.id.replace(/\/index$/, ''),
    title: d.title,
    description: d.description,
    shortTitle: d.shortTitle,
    category: d.category,
    series: d.series ?? null,
    seriesTitle: null,
    seriesOrder: d.seriesOrder ?? null,
    difficulty: d.difficulty,
    kind: d.kind,
    status: d.status,
    author: d.author,
    publishedAt: (d.publishedAt as Date).toISOString().slice(0, 10),
    updatedAt: d.updatedAt
      ? (d.updatedAt as Date).toISOString().slice(0, 10)
      : null,
    researchDate: d.researchDate
      ? (d.researchDate as Date).toISOString().slice(0, 10)
      : null,
    reviewedAt: d.reviewedAt
      ? (d.reviewedAt as Date).toISOString().slice(0, 10)
      : null,
    readingMinutes: d.readingMinutes ?? null,
    topics: d.topics ?? [],
    tags: d.tags ?? [],
    keyTakeaways: d.keyTakeaways ?? [],
    warnings: d.warnings ?? [],
    openQuestions: d.openQuestions ?? [],
    applicablePeriods: d.applicablePeriods ?? [],
    productStatus: d.productStatus ?? null,
    dataConfidence: d.dataConfidence ?? null,
    sources:
      d.sources?.map((s: any) =>
        typeof s === 'string' ? { id: s } : { id: s.id, supports: s.supports },
      ) ?? [],
    glossaryTerms:
      d.glossaryTerms?.map((g: any) =>
        typeof g === 'string' ? { id: g } : g,
      ) ?? [],
    relatedCalculators: d.relatedCalculators ?? [],
    relatedArticles: d.relatedArticles ?? [],
    faqs: d.faqs ?? [],
    body: entry.body ?? '',
    url: `/library/${entry.id.replace(/\/index$/, '')}/`,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
