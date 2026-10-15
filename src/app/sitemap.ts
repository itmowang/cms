import type { MetadataRoute } from "next";
import { allPublishedArticles, allTags, listChannels } from "@/lib/repo";
import { absUrl, articleUrl, channelUrl, tagUrl, toChannelMap } from "@/lib/urls";

export const revalidate = 600;

/** 单个 sitemap 上限 50000 条；超量时可改用 generateSitemaps 分片 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, channels, tags] = await Promise.all([allPublishedArticles(), listChannels(), allTags()]);
  const map = toChannelMap(channels);
  const now = new Date();

  return [
    { url: absUrl("/"), lastModified: now, changeFrequency: "always", priority: 1 },
    ...channels.map((c) => ({
      url: absUrl(channelUrl(c)),
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
    ...articles
      .filter((a) => map.has(a.channelId))
      .slice(0, 49000)
      .map((a) => ({
        url: absUrl(articleUrl(a, map.get(a.channelId)!)),
        lastModified: new Date(a.updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ...tags.map((t) => ({ url: absUrl(tagUrl(t)), changeFrequency: "daily" as const, priority: 0.4 })),
  ];
}
