/**
 * 伪静态 URL 规则（全站唯一出口，改规则只改这里 + 对应路由解析）
 *
 *   首页            /
 *   频道首页        /news
 *   频道分页        /news/list_2.html
 *   文章详情        /news/123.html
 *   文章 Markdown   /news/123.md        （给 AI / LLM 抓取的纯文本版本）
 *   标签            /tag/人工智能.html
 *   标签分页        无（标签页一次展示最近 50 篇）
 */
import type { Article, Channel } from "./types";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

/** 频道 slug 不能占用的保留目录 */
export const RESERVED_SLUGS = new Set([
  "admin", "api", "tag", "search", "uploads", "_next", "rss.xml", "sitemap.xml", "robots.txt",
  "llms.txt", "llms-full.txt", "news-sitemap.xml", "favicon.ico", "indexnow-key.txt", "icon.svg", "logo.svg",
]);

export const absUrl = (p: string) => (p.startsWith("http") ? p : `${SITE_URL}${p.startsWith("/") ? p : `/${p}`}`);

export const channelUrl = (c: Pick<Channel, "slug">, page = 1) =>
  page > 1 ? `/${c.slug}/list_${page}.html` : `/${c.slug}`;

export const articleUrl = (a: Pick<Article, "id">, c: Pick<Channel, "slug">) => `/${c.slug}/${a.id}.html`;

export const articleMdUrl = (a: Pick<Article, "id">, c: Pick<Channel, "slug">) => `/${c.slug}/${a.id}.md`;

export const tagUrl = (tag: string) => `/tag/${encodeURIComponent(tag)}.html`;

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export type ParsedFile = { type: "article"; id: number } | { type: "list"; page: number } | null;

/** 解析频道目录下的伪静态文件名 */
export function parseChannelFile(file: string): ParsedFile {
  const name = safeDecode(file);
  let m = /^(\d+)\.html$/.exec(name);
  if (m) return { type: "article", id: Number(m[1]) };
  if (name === "index.html") return { type: "list", page: 1 };
  m = /^list_(\d+)\.html$/.exec(name);
  if (m && Number(m[1]) >= 1) return { type: "list", page: Number(m[1]) };
  return null;
}

export function parseTagFile(file: string): string | null {
  const name = safeDecode(file);
  const m = /^(.+)\.html$/.exec(name);
  return m ? m[1] : null;
}

export type ChannelMap = Map<number, Channel>;

export const toChannelMap = (channels: Channel[]): ChannelMap => new Map(channels.map((c) => [c.id, c]));
