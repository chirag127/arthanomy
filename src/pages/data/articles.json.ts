/**
 * Static JSON API — list of published articles.
 *
 * /data/articles.json
 *
 * Fields intentionally exclude rendered body to keep the payload small.
 * Use /data/articles/<id>.json for the full record including body.
 */
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = async () => {
  const articles = await getCollection('articles', ({ data }) => !data.draft);
  const sorted = [...articles].sort(
    (a, b) =>
      (b.data.publishedAt as Date).getTime() -
      (a.data.publishedAt as Date).getTime(),
  );

  const payload = sorted.map((entry) => {
    const d = entry.data;
    return {
      id: entry.id.replace(/\/index$/, ''),
      title: d.title,
      description: d.description,
      category: d.category,
      series: d.series,
      seriesOrder: d.seriesOrder,
      difficulty: d.difficulty,
      kind: d.kind,
      status: d.status,
      publishedAt: (d.publishedAt as Date).toISOString().slice(0, 10),
      updatedAt: d.updatedAt
        ? (d.updatedAt as Date).toISOString().slice(0, 10)
        : null,
      readingMinutes: d.readingMinutes ?? null,
      author: d.author,
      sources:
        d.sources?.map((s: any) =>
          typeof s === 'string' ? s : s.id,
        ) ?? [],
      glossaryTerms: d.glossaryTerms?.map((g: any) => g.id) ?? [],
      keyTakeaways: d.keyTakeaways ?? [],
      url: `/library/${entry.id.replace(/\/index$/, '')}/`,
    };
  });

  return new Response(JSON.stringify(payload, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
