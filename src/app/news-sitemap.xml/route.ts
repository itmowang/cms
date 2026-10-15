import { getSettings, latestArticles, listChannels } from "@/lib/repo";
import { textResponse, xmlEscape } from "@/lib/feed";
import { absUrl, articleUrl, toChannelMap } from "@/lib/urls";

export const revalidate = 300;

/** Google News Sitemap：只收录最近 48 小时内发布的文章 */
export async function GET() {
  const [s, articles, channels] = await Promise.all([getSettings(), latestArticles(1000), listChannels()]);
  const map = toChannelMap(channels);
  const since = Date.now() - 48 * 3600 * 1000;
  const urls = articles
    .filter((a) => map.has(a.channelId) && new Date(a.publishedAt).getTime() >= since)
    .map(
      (a) => `  <url>
    <loc>${absUrl(articleUrl(a, map.get(a.channelId)!))}</loc>
    <news:news>
      <news:publication><news:name>${xmlEscape(s.name)}</news:name><news:language>zh-cn</news:language></news:publication>
      <news:publication_date>${a.publishedAt}</news:publication_date>
      <news:title>${xmlEscape(a.title)}</news:title>
    </news:news>
  </url>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;
  return textResponse(xml, "application/xml", 300);
}
