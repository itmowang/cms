import "server-only";
import { readDb, writeDb } from "./db";
import type { Article, Channel, SiteSettings } from "./types";

export const PAGE_SIZE = 20;

const byPublishedDesc = (a: Article, b: Article) => b.publishedAt.localeCompare(a.publishedAt);

function published(articles: Article[]): Article[] {
  const now = new Date().toISOString();
  return articles.filter((a) => a.status === "published" && a.publishedAt <= now);
}

/* ---------------- 站点 ---------------- */

export async function getSettings(): Promise<SiteSettings> {
  return (await readDb()).settings;
}

export async function updateSettings(patch: Partial<SiteSettings>): Promise<void> {
  await writeDb((db) => {
    db.settings = { ...db.settings, ...patch };
  });
}

/* ---------------- 频道 ---------------- */

export async function listChannels(): Promise<Channel[]> {
  return [...(await readDb()).channels].sort((a, b) => a.sort - b.sort);
}

export async function getChannelBySlug(slug: string): Promise<Channel | undefined> {
  return (await readDb()).channels.find((c) => c.slug === slug);
}

export async function getChannelById(id: number): Promise<Channel | undefined> {
  return (await readDb()).channels.find((c) => c.id === id);
}

export async function saveChannel(input: Omit<Channel, "id"> & { id?: number }): Promise<Channel> {
  return writeDb((db) => {
    const dup = db.channels.find((c) => c.slug === input.slug && c.id !== input.id);
    if (dup) throw new Error(`目录名 ${input.slug} 已被频道「${dup.name}」使用`);
    if (input.id) {
      const idx = db.channels.findIndex((c) => c.id === input.id);
      if (idx < 0) throw new Error("频道不存在");
      db.channels[idx] = { ...db.channels[idx], ...input, id: input.id };
      return db.channels[idx];
    }
    const channel: Channel = { ...input, id: ++db.seq.channel };
    db.channels.push(channel);
    return channel;
  });
}

export async function deleteChannel(id: number): Promise<void> {
  await writeDb((db) => {
    if (db.articles.some((a) => a.channelId === id)) throw new Error("该频道下还有文章，无法删除");
    db.channels = db.channels.filter((c) => c.id !== id);
  });
}

/* ---------------- 文章（前台只读已发布） ---------------- */

export async function getPublishedArticle(id: number): Promise<Article | undefined> {
  const a = (await readDb()).articles.find((x) => x.id === id);
  return a && published([a]).length ? a : undefined;
}

export async function latestArticles(limit = 20, channelId?: number): Promise<Article[]> {
  const list = published((await readDb()).articles).filter((a) => !channelId || a.channelId === channelId);
  return list.sort(byPublishedDesc).slice(0, limit);
}

export async function allPublishedArticles(): Promise<Article[]> {
  return published((await readDb()).articles).sort(byPublishedDesc);
}

export async function headlineArticles(limit = 3): Promise<Article[]> {
  return published((await readDb()).articles).filter((a) => a.isHeadline).sort(byPublishedDesc).slice(0, limit);
}

export async function focusArticles(limit = 5): Promise<Article[]> {
  return published((await readDb()).articles).filter((a) => a.isFocus).sort(byPublishedDesc).slice(0, limit);
}

export async function hotArticles(limit = 10, channelId?: number): Promise<Article[]> {
  const list = published((await readDb()).articles).filter((a) => !channelId || a.channelId === channelId);
  return list.sort((a, b) => b.views - a.views).slice(0, limit);
}

export async function pagedChannelArticles(channelId: number, page: number) {
  const list = published((await readDb()).articles).filter((a) => a.channelId === channelId).sort(byPublishedDesc);
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  return { items: list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), totalPages, total: list.length };
}

export async function articlesByTag(tag: string, limit = 50): Promise<Article[]> {
  return published((await readDb()).articles).filter((a) => a.tags.includes(tag)).sort(byPublishedDesc).slice(0, limit);
}

export async function allTags(): Promise<string[]> {
  const set = new Set<string>();
  published((await readDb()).articles).forEach((a) => a.tags.forEach((t) => set.add(t)));
  return [...set];
}

/** 按使用次数排序的热门标签（导航热词、标签云） */
export async function topTags(limit = 20): Promise<Array<{ tag: string; count: number }>> {
  const db = await readDb();
  // 与分类同名的标签（如「家常菜」）对导航没有增量，排除掉
  const channelNames = new Set(db.channels.map((c) => c.name));
  const counter = new Map<string, number>();
  published(db.articles).forEach((a) =>
    a.tags.filter((t) => !channelNames.has(t)).forEach((t) => counter.set(t, (counter.get(t) ?? 0) + 1)),
  );
  return [...counter.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-CN"))
    .slice(0, limit);
}

export async function relatedArticles(article: Article, limit = 8): Promise<Article[]> {
  const list = published((await readDb()).articles).filter((a) => a.id !== article.id);
  const score = (a: Article) =>
    a.tags.filter((t) => article.tags.includes(t)).length * 2 + (a.channelId === article.channelId ? 1 : 0);
  return list
    .map((a) => ({ a, s: score(a) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s || byPublishedDesc(x.a, y.a))
    .slice(0, limit)
    .map((x) => x.a);
}

/** 上一篇 / 下一篇（同频道） */
export async function adjacentArticles(article: Article) {
  const list = published((await readDb()).articles)
    .filter((a) => a.channelId === article.channelId)
    .sort(byPublishedDesc);
  const idx = list.findIndex((a) => a.id === article.id);
  return { newer: idx > 0 ? list[idx - 1] : undefined, older: idx >= 0 ? list[idx + 1] : undefined };
}

export async function searchArticles(keyword: string, limit = 50): Promise<Article[]> {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return [];
  return published((await readDb()).articles)
    // 支持按食材搜索，如 "鸡蛋"、"五花肉"
    .filter((a) =>
      [a.title, a.summary, a.tags.join(" "), a.content, a.recipe?.ingredients.map((i) => i.name).join(" ") ?? ""].some((s) =>
        s.toLowerCase().includes(kw),
      ),
    )
    .sort(byPublishedDesc)
    .slice(0, limit);
}

export async function incrementViews(id: number): Promise<void> {
  await writeDb((db) => {
    const a = db.articles.find((x) => x.id === id);
    if (a) a.views += 1;
  });
}

/* ---------------- 文章（后台） ---------------- */

export async function adminListArticles(opts: {
  keyword?: string;
  channelId?: number;
  status?: Article["status"];
  page: number;
  pageSize?: number;
  /** 只返回前台可见的文章（已发布且已到发布时间） */
  visibleOnly?: boolean;
}) {
  const kw = opts.keyword?.trim().toLowerCase();
  const all = (await readDb()).articles;
  const list = (opts.visibleOnly ? published(all) : all)
    .filter(
      (a) =>
        (!opts.channelId || a.channelId === opts.channelId) &&
        (!opts.status || a.status === opts.status) &&
        (!kw || a.title.toLowerCase().includes(kw)),
    )
    .sort((a, b) => b.id - a.id);
  const size = opts.pageSize ?? 30;
  return {
    items: list.slice((opts.page - 1) * size, opts.page * size),
    totalPages: Math.max(1, Math.ceil(list.length / size)),
    total: list.length,
  };
}

export async function adminGetArticle(id: number): Promise<Article | undefined> {
  return (await readDb()).articles.find((a) => a.id === id);
}

export type ArticleInput = Omit<Article, "id" | "views" | "createdAt" | "updatedAt">;

export async function saveArticle(input: ArticleInput & { id?: number }): Promise<Article> {
  return writeDb((db) => {
    if (!db.channels.some((c) => c.id === input.channelId)) throw new Error("所属频道不存在");
    const now = new Date().toISOString();
    if (input.id) {
      const idx = db.articles.findIndex((a) => a.id === input.id);
      if (idx < 0) throw new Error("文章不存在");
      db.articles[idx] = { ...db.articles[idx], ...input, id: input.id, updatedAt: now };
      return db.articles[idx];
    }
    const article: Article = { ...input, id: ++db.seq.article, views: 0, createdAt: now, updatedAt: now };
    db.articles.push(article);
    return article;
  });
}

export async function deleteArticle(id: number): Promise<Article | undefined> {
  return writeDb((db) => {
    const a = db.articles.find((x) => x.id === id);
    db.articles = db.articles.filter((x) => x.id !== id);
    return a;
  });
}

export async function stats() {
  const db = await readDb();
  return {
    channels: db.channels.length,
    articles: db.articles.length,
    published: db.articles.filter((a) => a.status === "published").length,
    drafts: db.articles.filter((a) => a.status === "draft").length,
    views: db.articles.reduce((s, a) => s + a.views, 0),
  };
}
