import type { Article, Channel } from "./types";
import { absUrl, articleMdUrl, articleUrl, channelUrl } from "./urls";
import { formatDate } from "./markdown";
import { recipeToMarkdown } from "./recipe";

export const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** 单篇文章的 Markdown 表示：带 YAML front matter，方便 LLM 精准解析元数据 */
export function articleToMarkdown(a: Article, c: Channel, siteName: string): string {
  const fm = [
    "---",
    `title: ${JSON.stringify(a.title)}`,
    `url: ${absUrl(articleUrl(a, c))}`,
    `channel: ${JSON.stringify(c.name)}`,
    `author: ${JSON.stringify(a.author)}`,
    `source: ${JSON.stringify(a.source)}`,
    `published: ${a.publishedAt}`,
    `updated: ${a.updatedAt}`,
    `tags: [${a.tags.map((t) => JSON.stringify(t)).join(", ")}]`,
    `publisher: ${JSON.stringify(siteName)}`,
    ...(a.recipe
      ? [
          "type: recipe",
          `difficulty: ${JSON.stringify(a.recipe.difficulty)}`,
          `prep_minutes: ${a.recipe.prepMinutes}`,
          `cook_minutes: ${a.recipe.cookMinutes}`,
          `servings: ${JSON.stringify(a.recipe.servings)}`,
        ]
      : []),
    "---",
  ].join("\n");
  const recipe = a.recipe ? `${recipeToMarkdown(a.recipe)}\n\n` : "";
  return `${fm}\n\n# ${a.title}\n\n> ${a.summary}\n\n${recipe}${a.content.trim()}\n`;
}

/** llms.txt 中的一行 */
export function llmsLine(a: Article, c: Channel): string {
  return `- [${a.title}](${absUrl(articleMdUrl(a, c))}): ${formatDate(a.publishedAt, false)} ${a.summary.slice(0, 80)}`;
}

export function channelLine(c: Channel): string {
  return `- [${c.name}](${absUrl(channelUrl(c))}): ${c.description}`;
}

export const textResponse = (body: string, type: string, maxAge = 600) =>
  new Response(body, {
    headers: {
      "Content-Type": `${type}; charset=utf-8`,
      "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=86400`,
    },
  });
