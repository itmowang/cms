import type { Article, Channel, SiteSettings } from "./types";
import { absUrl, articleMdUrl, articleUrl, channelUrl, SITE_URL } from "./urls";
import { markdownToText } from "./markdown";

/**
 * 结构化数据（schema.org JSON-LD）：
 * 百度、Google、Bing 以及各类 AI 爬虫（GPTBot / ClaudeBot / PerplexityBot 等）
 * 都会解析，能准确拿到标题、作者、发布时间、正文、面包屑等语义信息。
 */

export function websiteLd(s: SiteSettings) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: s.name,
        description: s.description,
        inLanguage: "zh-CN",
        publisher: { "@id": `${SITE_URL}/#org` },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={q}` },
          "query-input": "required name=q",
        },
      },
      {
        "@type": "NewsMediaOrganization",
        "@id": `${SITE_URL}/#org`,
        name: s.name,
        url: SITE_URL,
        logo: { "@type": "ImageObject", url: absUrl("/logo.svg") },
      },
    ],
  };
}

export function breadcrumbLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absUrl(it.url),
    })),
  };
}

export function articleLd(a: Article, c: Channel, s: SiteSettings) {
  const url = absUrl(articleUrl(a, c));
  const text = markdownToText(a.content);
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "@id": `${url}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    headline: a.title.slice(0, 110),
    description: a.summary,
    articleSection: c.name,
    keywords: a.tags.join(","),
    inLanguage: "zh-CN",
    datePublished: a.publishedAt,
    dateModified: a.updatedAt,
    wordCount: text.length,
    image: a.cover ? [absUrl(a.cover)] : [absUrl("/logo.svg")],
    author: { "@type": "Person", name: a.author || s.name },
    publisher: { "@id": `${SITE_URL}/#org`, "@type": "NewsMediaOrganization", name: s.name, logo: { "@type": "ImageObject", url: absUrl("/logo.svg") } },
    isAccessibleForFree: true,
    // 提供纯文本 Markdown 版本，方便 LLM 精准抽取
    encoding: { "@type": "MediaObject", encodingFormat: "text/markdown", contentUrl: absUrl(articleMdUrl(a, c)) },
    articleBody: text.slice(0, 5000),
  };
}

export function itemListLd(name: string, items: Array<{ a: Article; c: Channel }>) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map(({ a, c }, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absUrl(articleUrl(a, c)),
      name: a.title,
    })),
  };
}

export function channelPageUrl(c: Channel, page: number) {
  return absUrl(channelUrl(c, page));
}
