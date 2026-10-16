/**
 * LLM-friendly full text — every published article concatenated with frontmatter.
 */
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = async () => {
  const articles = await getCollection('articles', ({ data }) => !data.draft);
  const sorted = [...articles].sort((a, b) =>
    (a.data.title as string).localeCompare(b.data.title as string),
  );

  const parts = sorted.map((entry) => {
    const d = entry.data;
    const id = entry.id.replace(/\/index$/, '');
    const head = [
      `# ${d.title}`,
      `URL: /library/${id}/`,
      `Category: ${d.category} | Difficulty: ${d.difficulty} | Kind: ${d.kind}`,
      d.description,
      '',
    ].join('\n');
    return head + (entry.body ?? '');
  });

  return new Response(parts.join('\n\n---\n\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
