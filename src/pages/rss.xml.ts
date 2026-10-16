/**
 * /rss.xml — the feed of published articles.
 */
import { getCollection } from 'astro:content';
import { absoluteUrl } from '../lib/url';

export async function GET(context: { site?: URL }) {
  const articles = await getCollection('articles', ({ data }) => !data.draft);
  const sorted = articles.sort((a, b) => (b.data.publishedAt as Date).getTime() - (a.data.publishedAt as Date).getTime());

  const items = sorted.map((entry) => {
    const url = absoluteUrl(`/library/${entry.id}`, context.site);
    return `    <item>
      <title>${escapeXml(entry.data.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(entry.data.description)}</description>
      <pubDate>${new Date(entry.data.publishedAt).toUTCString()}</pubDate>
      ${entry.data.category ? `<category>${escapeXml(entry.data.category)}</category>` : ''}
    </item>`;
  });

  const feedUrl = absoluteUrl('/rss.xml', context.site);
  const siteUrl = absoluteUrl('/', context.site);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Arthanomy — The Science of Wealth</title>
    <link>${siteUrl}</link>
    <description>Source-driven research on Indian investment avenues, taxation, portfolio construction and investor protection.</description>
    <language>en-in</language>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
${items.join('\n')}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
