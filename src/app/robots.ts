import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/urls";

/** 搜索引擎 + 主流 AI 爬虫：明确放行内容页，屏蔽后台与接口 */
const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended", "CCBot", "Meta-ExternalAgent",
  "Bytespider", "YisouSpider", "ChatGLM-Spider", "Baiduspider-render",
];

const SEARCH_BOTS = ["Baiduspider", "Sogou web spider", "360Spider", "Googlebot", "Bingbot", "YandexBot"];

export default function robots(): MetadataRoute.Robots {
  const disallow = ["/admin", "/api/", "/search"];
  return {
    rules: [
      { userAgent: SEARCH_BOTS, allow: "/", disallow },
      // AI 爬虫显式放行：包括 /频道/ID.md 纯文本版本、/llms.txt、/llms-full.txt
      { userAgent: AI_BOTS, allow: "/", disallow },
      { userAgent: "*", allow: "/", disallow },
    ],
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/news-sitemap.xml`],
    host: SITE_URL,
  };
}
