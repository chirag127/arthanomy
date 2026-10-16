/**
 * LLM-friendly index — list of published articles with short descriptions.
 * https://llmstxt.org/
 */
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = async () => {
  const articles = await getCollection('articles', ({ data }) => !data.draft);
  const sorted = [...articles].sort((a, b) =>
    (a.data.title as string).localeCompare(b.data.title as string),
  );

  const lines: string[] = [
    '# Arthanomy — The Science of Wealth',
    '',
    '> A source-driven Indian investment, taxation and wealth intelligence library.',
    '> Understand every asset, quantify every risk, and see what you actually keep after taxes, fees and inflation.',
    '> All figures are research estimates or clearly-labelled illustrative models. Independent educational research, not advice.',
    '',
    '## Articles',
    '',
    ...sorted.map((entry) => {
      const d = entry.data;
      const id = entry.id.replace(/\/index$/, '');
      return `- [${d.title}](/library/${id}/): ${d.description}`;
    }),
    '',
    '## Machine-readable full text',
    '',
    '- [/llms-full.txt](/llms-full.txt): full text of every published article.',
    '- [/data/articles.json](/data/articles.json): JSON list of all articles.',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
