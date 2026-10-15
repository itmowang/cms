import { renderMarkdown } from "@/lib/markdown";
import { getSettings, latestArticles, listChannels } from "@/lib/repo";
import { textResponse, xmlEscape } from "@/lib/feed";
import { absUrl, articleUrl, SITE_URL, toChannelMap } from "@/lib/urls";

export const revalidate = 600;

export async function GET() {
  const [s, articles, channels] = await Promise.all([getSettings(), latestArticles(50), listChannels()]);
  const map = toChannelMap(channels);
  const items = articles
    .filter((a) => map.has(a.channelId))
    .map((a) => {
      const c = map.get(a.channelId)!;
      const url = absUrl(articleUrl(a, c));
      return `    <item>
      <title>${xmlEscape(a.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <category>${xmlEscape(c.name)}</category>
      <author>${xmlEscape(a.author)}</author>
      <pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>
      <description>${xmlEscape(a.summary)}</description>
      <content:encoded><![CDATA[${renderMarkdown(a.content).replace(/]]>/g, "]]]]><![CDATA[>")}]]></content:encoded>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(s.name)}</title>
    <link>${SITE_URL}</link>
    <description>${xmlEscape(s.description)}</description>
    <language>zh-cn</language>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
  return textResponse(xml, "application/rss+xml");
}
