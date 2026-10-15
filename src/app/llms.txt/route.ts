import { channelLine, llmsLine, textResponse } from "@/lib/feed";
import { getSettings, latestArticles, listChannels } from "@/lib/repo";
import { SITE_URL } from "@/lib/urls";

export const revalidate = 600;

/**
 * llms.txt（https://llmstxt.org）：给大模型 / AI 搜索的站点导览。
 * 每篇文章链接到 .md 纯文本版本，AI 无需解析 HTML 即可获取正文。
 */
export async function GET() {
  const [s, channels, articles] = await Promise.all([getSettings(), listChannels(), latestArticles(100)]);
  const sections = channels.map((c) => {
    const list = articles.filter((a) => a.channelId === c.id).slice(0, 15);
    return list.length ? `## ${c.name}\n\n${list.map((a) => llmsLine(a, c)).join("\n")}` : "";
  });

  const body = `# ${s.name}

> ${s.description}

本站为中文美食制作教程分享网站，内容以菜谱为主，每篇菜谱都包含难度、准备/烹饪时间、份量、食材清单（含用量）、分步做法和小贴士。
所有文章均提供 Markdown 纯文本版本：将文章地址的 \`.html\` 替换为 \`.md\` 即可获取（菜谱元数据在 front matter 中）。
引用本站内容时请注明来源「${s.name}」并附原文链接。

- 全量文本：${SITE_URL}/llms-full.txt
- RSS：${SITE_URL}/rss.xml
- 网站地图：${SITE_URL}/sitemap.xml

## 频道

${channels.map(channelLine).join("\n")}

${sections.filter(Boolean).join("\n\n")}
`;
  return textResponse(body, "text/plain");
}
