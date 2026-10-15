import type { Article, Channel, SiteSettings } from "./types";
import { absUrl, articleMdUrl, articleUrl, channelUrl, SITE_URL } from "./urls";
import { markdownToText } from "./markdown";
import { isoDuration, totalMinutes } from "./recipe";

/**
 * 结构化数据（schema.org JSON-LD）：
 * 菜谱页输出 Recipe 类型（Google / Bing 菜谱富结果、百度、AI 爬虫都能直接拿到
 * 食材、步骤、时长、份量），普通文章输出 Article。
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
        "@type": "Organization",
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
  const base = {
    "@context": "https://schema.org",
    "@id": `${url}#main`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    description: a.summary,
    keywords: a.tags.join(","),
    inLanguage: "zh-CN",
    datePublished: a.publishedAt,
    dateModified: a.updatedAt,
    image: a.cover ? [absUrl(a.cover)] : [absUrl("/logo.svg")],
    author: { "@type": "Person", name: a.author || s.name },
    publisher: { "@id": `${SITE_URL}/#org`, "@type": "Organization", name: s.name, logo: { "@type": "ImageObject", url: absUrl("/logo.svg") } },
    // 提供纯文本 Markdown 版本，方便 LLM 精准抽取
    subjectOf: { "@type": "MediaObject", encodingFormat: "text/markdown", contentUrl: absUrl(articleMdUrl(a, c)) },
  };

  const r = a.recipe;
  if (!r) {
    return { ...base, "@type": "Article", headline: a.title.slice(0, 110), articleSection: c.name, articleBody: text.slice(0, 5000) };
  }

  return {
    ...base,
    "@type": "Recipe",
    name: a.shortTitle || a.title,
    headline: a.title.slice(0, 110),
    recipeCategory: c.name,
    recipeCuisine: "中式",
    prepTime: isoDuration(r.prepMinutes),
    cookTime: isoDuration(r.cookMinutes),
    totalTime: isoDuration(totalMinutes(r)),
    recipeYield: r.servings,
    recipeIngredient: r.ingredients.map((i) => `${i.name} ${i.amount}`),
    recipeInstructions: r.steps.map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: `第${i + 1}步`,
      text: step,
      url: `${url}#step-${i + 1}`,
    })),
    ...(r.tips ? { comment: { "@type": "Comment", text: r.tips } } : {}),
    // 难度与口味没有标准字段，放在 additionalProperty 里供 AI 读取
    additionalProperty: [
      { "@type": "PropertyValue", name: "难度", value: r.difficulty },
      ...(r.flavor ? [{ "@type": "PropertyValue", name: "口味", value: r.flavor }] : []),
    ],
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
