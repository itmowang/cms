import { articleToMarkdown, textResponse } from "@/lib/feed";
import { getSettings, latestArticles, listChannels } from "@/lib/repo";
import { toChannelMap } from "@/lib/urls";

export const revalidate = 1800;

/** 最近 200 篇文章全文合集，供 AI 一次性抓取 */
export async function GET() {
  const [s, channels, articles] = await Promise.all([getSettings(), listChannels(), latestArticles(200)]);
  const map = toChannelMap(channels);
  const body = articles
    .filter((a) => map.has(a.channelId))
    .map((a) => articleToMarkdown(a, map.get(a.channelId)!, s.name))
    .join("\n\n");
  return textResponse(`# ${s.name} 全文索引\n\n> ${s.description}\n\n${body}`, "text/plain", 1800);
}
