import "server-only";
import { pgCode, query, queryOne } from "./db";
import type { Article, Channel, RecipeInfo, SiteSettings } from "./types";

export const PAGE_SIZE = 20;

/* ---------------- 行映射 ---------------- */

interface ChannelRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  keywords: string;
  sort: number;
  show_in_nav: boolean;
  icon: string | null;
}

interface ArticleRow {
  id: number;
  channel_id: number;
  title: string;
  short_title: string | null;
  summary: string;
  content: string;
  cover: string | null;
  author: string;
  source: string;
  tags: string[];
  is_headline: boolean;
  is_focus: boolean;
  status: Article["status"];
  views: number;
  published_at: Date;
  created_at: Date;
  updated_at: Date;
  recipe: RecipeInfo | null;
}

const CHANNEL_COLS = "id, slug, name, description, keywords, sort, show_in_nav, icon";
const ARTICLE_COLS =
  "id, channel_id, title, short_title, summary, content, cover, author, source, tags, is_headline, is_focus, status, views, published_at, created_at, updated_at, recipe";
/** 前台可见：已发布且已到发布时间（定时发布） */
const VISIBLE = "status = 'published' AND published_at <= now()";
const NEWEST = "published_at DESC, id DESC";

function toChannel(r: ChannelRow): Channel {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    keywords: r.keywords,
    sort: r.sort,
    showInNav: r.show_in_nav,
    icon: r.icon ?? undefined,
  };
}

function toArticle(r: ArticleRow): Article {
  return {
    id: r.id,
    channelId: r.channel_id,
    title: r.title,
    shortTitle: r.short_title ?? undefined,
    summary: r.summary,
    content: r.content,
    cover: r.cover ?? undefined,
    author: r.author,
    source: r.source,
    tags: r.tags,
    isHeadline: r.is_headline,
    isFocus: r.is_focus,
    status: r.status,
    views: r.views,
    publishedAt: r.published_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    createdAt: r.created_at.toISOString(),
    recipe: r.recipe ?? undefined,
  };
}

const articles = async (sql: string, params: unknown[] = []) => (await query<ArticleRow>(sql, params)).map(toArticle);

/** LIKE 模式转义，避免用户输入的 % _ 变成通配符 */
const likePattern = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/* ---------------- 站点 ---------------- */

export async function getSettings(): Promise<SiteSettings> {
  const row = await queryOne<{ data: SiteSettings }>("SELECT data FROM settings WHERE id = 1");
  if (!row) throw new Error("站点设置不存在，请先执行 db/migrate.sh 初始化数据库");
  return row.data;
}

export async function updateSettings(patch: Partial<SiteSettings>): Promise<void> {
  await query(
    `INSERT INTO settings (id, data) VALUES (1, $1::jsonb)
     ON CONFLICT (id) DO UPDATE SET data = settings.data || EXCLUDED.data`,
    [JSON.stringify(patch)],
  );
}

/* ---------------- 频道 ---------------- */

export async function listChannels(): Promise<Channel[]> {
  return (await query<ChannelRow>(`SELECT ${CHANNEL_COLS} FROM channels ORDER BY sort, id`)).map(toChannel);
}

export async function getChannelBySlug(slug: string): Promise<Channel | undefined> {
  const r = await queryOne<ChannelRow>(`SELECT ${CHANNEL_COLS} FROM channels WHERE slug = $1`, [slug]);
  return r && toChannel(r);
}

export async function getChannelById(id: number): Promise<Channel | undefined> {
  if (!Number.isInteger(id)) return undefined;
  const r = await queryOne<ChannelRow>(`SELECT ${CHANNEL_COLS} FROM channels WHERE id = $1`, [id]);
  return r && toChannel(r);
}

export async function saveChannel(input: Omit<Channel, "id"> & { id?: number }): Promise<Channel> {
  const dup = await queryOne<{ name: string }>("SELECT name FROM channels WHERE slug = $1 AND id <> $2", [input.slug, input.id ?? 0]);
  if (dup) throw new Error(`目录名 ${input.slug} 已被频道「${dup.name}」使用`);

  const values = [input.slug, input.name, input.description, input.keywords, input.sort, input.showInNav, input.icon ?? null];
  try {
    const row = input.id
      ? await queryOne<ChannelRow>(
          `UPDATE channels SET slug = $1, name = $2, description = $3, keywords = $4, sort = $5, show_in_nav = $6, icon = $7
           WHERE id = $8 RETURNING ${CHANNEL_COLS}`,
          [...values, input.id],
        )
      : await queryOne<ChannelRow>(
          `INSERT INTO channels (slug, name, description, keywords, sort, show_in_nav, icon)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${CHANNEL_COLS}`,
          values,
        );
    if (!row) throw new Error("频道不存在");
    return toChannel(row);
  } catch (e) {
    // 并发情况下唯一约束兜底
    if (pgCode(e) === "23505") throw new Error(`目录名 ${input.slug} 已被其他频道使用`);
    throw e;
  }
}

export async function deleteChannel(id: number): Promise<void> {
  const used = await queryOne("SELECT 1 FROM articles WHERE channel_id = $1 LIMIT 1", [id]);
  if (used) throw new Error("该频道下还有文章，无法删除");
  try {
    await query("DELETE FROM channels WHERE id = $1", [id]);
  } catch (e) {
    if (pgCode(e) === "23503") throw new Error("该频道下还有文章，无法删除");
    throw e;
  }
}

/* ---------------- 文章（前台只读已发布） ---------------- */

export async function getPublishedArticle(id: number): Promise<Article | undefined> {
  if (!Number.isInteger(id)) return undefined;
  return (await articles(`SELECT ${ARTICLE_COLS} FROM articles WHERE id = $1 AND ${VISIBLE}`, [id]))[0];
}

export async function latestArticles(limit = 20, channelId?: number): Promise<Article[]> {
  return channelId
    ? articles(`SELECT ${ARTICLE_COLS} FROM articles WHERE ${VISIBLE} AND channel_id = $1 ORDER BY ${NEWEST} LIMIT $2`, [channelId, limit])
    : articles(`SELECT ${ARTICLE_COLS} FROM articles WHERE ${VISIBLE} ORDER BY ${NEWEST} LIMIT $1`, [limit]);
}

export async function allPublishedArticles(): Promise<Article[]> {
  return articles(`SELECT ${ARTICLE_COLS} FROM articles WHERE ${VISIBLE} ORDER BY ${NEWEST}`);
}

export async function headlineArticles(limit = 3): Promise<Article[]> {
  return articles(`SELECT ${ARTICLE_COLS} FROM articles WHERE ${VISIBLE} AND is_headline ORDER BY ${NEWEST} LIMIT $1`, [limit]);
}

export async function focusArticles(limit = 5): Promise<Article[]> {
  return articles(`SELECT ${ARTICLE_COLS} FROM articles WHERE ${VISIBLE} AND is_focus ORDER BY ${NEWEST} LIMIT $1`, [limit]);
}

export async function hotArticles(limit = 10, channelId?: number): Promise<Article[]> {
  return channelId
    ? articles(`SELECT ${ARTICLE_COLS} FROM articles WHERE ${VISIBLE} AND channel_id = $1 ORDER BY views DESC, id DESC LIMIT $2`, [channelId, limit])
    : articles(`SELECT ${ARTICLE_COLS} FROM articles WHERE ${VISIBLE} ORDER BY views DESC, id DESC LIMIT $1`, [limit]);
}

export async function pagedChannelArticles(channelId: number, page: number) {
  const [items, count] = await Promise.all([
    articles(`SELECT ${ARTICLE_COLS} FROM articles WHERE ${VISIBLE} AND channel_id = $1 ORDER BY ${NEWEST} LIMIT $2 OFFSET $3`, [
      channelId,
      PAGE_SIZE,
      (Math.max(1, page) - 1) * PAGE_SIZE,
    ]),
    queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM articles WHERE ${VISIBLE} AND channel_id = $1`, [channelId]),
  ]);
  const total = count?.n ?? 0;
  return { items, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total };
}

export async function articlesByTag(tag: string, limit = 50): Promise<Article[]> {
  return articles(`SELECT ${ARTICLE_COLS} FROM articles WHERE ${VISIBLE} AND tags @> ARRAY[$1::text] ORDER BY ${NEWEST} LIMIT $2`, [tag, limit]);
}

export async function allTags(): Promise<string[]> {
  return (await query<{ tag: string }>(`SELECT DISTINCT unnest(tags) AS tag FROM articles WHERE ${VISIBLE}`)).map((r) => r.tag);
}

/** 按使用次数排序的热门标签（导航热词、标签云） */
export async function topTags(limit = 20): Promise<Array<{ tag: string; count: number }>> {
  // 与分类同名的标签（如「家常菜」）对导航没有增量，排除掉
  const rows = await query<{ tag: string; count: number }>(
    `SELECT t AS tag, count(*)::int AS count
     FROM articles a CROSS JOIN LATERAL unnest(a.tags) AS t
     WHERE a.status = 'published' AND a.published_at <= now() AND t NOT IN (SELECT name FROM channels)
     GROUP BY t`,
  );
  // 同频次按拼音排序（数据库排序规则不一定是中文）
  return rows.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-CN")).slice(0, limit);
}

export async function relatedArticles(article: Article, limit = 8): Promise<Article[]> {
  // 相同标签每个 +2，同频道 +1
  return articles(
    `SELECT ${ARTICLE_COLS} FROM (
       SELECT *, cardinality(ARRAY(SELECT unnest(tags) INTERSECT SELECT unnest($2::text[]))) * 2
                 + (channel_id = $3)::int AS score
       FROM articles
       WHERE ${VISIBLE} AND id <> $1 AND (tags && $2::text[] OR channel_id = $3)
     ) s
     ORDER BY score DESC, ${NEWEST} LIMIT $4`,
    [article.id, article.tags, article.channelId, limit],
  );
}

/** 上一篇 / 下一篇（同频道，按发布时间） */
export async function adjacentArticles(article: Article) {
  const params = [article.channelId, article.publishedAt, article.id];
  const [newer, older] = await Promise.all([
    articles(
      `SELECT ${ARTICLE_COLS} FROM articles WHERE ${VISIBLE} AND channel_id = $1 AND (published_at, id) > ($2::timestamptz, $3)
       ORDER BY published_at, id LIMIT 1`,
      params,
    ),
    articles(
      `SELECT ${ARTICLE_COLS} FROM articles WHERE ${VISIBLE} AND channel_id = $1 AND (published_at, id) < ($2::timestamptz, $3)
       ORDER BY ${NEWEST} LIMIT 1`,
      params,
    ),
  ]);
  return { newer: newer[0], older: older[0] };
}

export async function searchArticles(keyword: string, limit = 50): Promise<Article[]> {
  const kw = keyword.trim();
  if (!kw) return [];
  // 支持按食材搜索，如 "鸡蛋"、"五花肉"
  return articles(
    `SELECT ${ARTICLE_COLS} FROM articles
     WHERE ${VISIBLE} AND (
       title ILIKE $1 OR summary ILIKE $1 OR array_to_string(tags, ' ') ILIKE $1 OR content ILIKE $1
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(recipe -> 'ingredients', '[]')) i WHERE i ->> 'name' ILIKE $1)
     )
     ORDER BY ${NEWEST} LIMIT $2`,
    [likePattern(kw), limit],
  );
}

/** 阅读数 +1：单行原子更新，不影响其他数据 */
export async function incrementViews(id: number): Promise<void> {
  await query("UPDATE articles SET views = views + 1 WHERE id = $1", [id]);
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
  const where: string[] = [];
  const params: unknown[] = [];
  const kw = opts.keyword?.trim();
  if (opts.visibleOnly) where.push(VISIBLE);
  if (opts.channelId) where.push(`channel_id = $${params.push(opts.channelId)}`);
  if (opts.status) where.push(`status = $${params.push(opts.status)}`);
  if (kw) where.push(`title ILIKE $${params.push(likePattern(kw))}`);
  const cond = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const size = opts.pageSize ?? 30;
  const page = Math.max(1, opts.page);
  const [items, count] = await Promise.all([
    articles(`SELECT ${ARTICLE_COLS} FROM articles ${cond} ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [
      ...params,
      size,
      (page - 1) * size,
    ]),
    queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM articles ${cond}`, params),
  ]);
  const total = count?.n ?? 0;
  return { items, totalPages: Math.max(1, Math.ceil(total / size)), total };
}

export async function adminGetArticle(id: number): Promise<Article | undefined> {
  if (!Number.isInteger(id)) return undefined;
  return (await articles(`SELECT ${ARTICLE_COLS} FROM articles WHERE id = $1`, [id]))[0];
}

export type ArticleInput = Omit<Article, "id" | "views" | "createdAt" | "updatedAt">;

export async function saveArticle(input: ArticleInput & { id?: number }): Promise<Article> {
  if (!(await getChannelById(input.channelId))) throw new Error("所属频道不存在");
  const values = [
    input.channelId,
    input.title,
    input.shortTitle ?? null,
    input.summary,
    input.content,
    input.cover ?? null,
    input.author,
    input.source,
    input.tags,
    input.isHeadline,
    input.isFocus,
    input.status,
    input.publishedAt,
    input.recipe ? JSON.stringify(input.recipe) : null,
  ];
  const rows = input.id
    ? await articles(
        `UPDATE articles SET channel_id = $1, title = $2, short_title = $3, summary = $4, content = $5, cover = $6, author = $7,
           source = $8, tags = $9, is_headline = $10, is_focus = $11, status = $12, published_at = $13, recipe = $14::jsonb,
           updated_at = now()
         WHERE id = $15 RETURNING ${ARTICLE_COLS}`,
        [...values, input.id],
      )
    : await articles(
        `INSERT INTO articles (channel_id, title, short_title, summary, content, cover, author, source, tags,
           is_headline, is_focus, status, published_at, recipe)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb) RETURNING ${ARTICLE_COLS}`,
        values,
      );
  if (!rows[0]) throw new Error("文章不存在");
  return rows[0];
}

export async function deleteArticle(id: number): Promise<Article | undefined> {
  if (!Number.isInteger(id)) return undefined;
  return (await articles(`DELETE FROM articles WHERE id = $1 RETURNING ${ARTICLE_COLS}`, [id]))[0];
}

export async function stats() {
  const [r] = await query<{ channels: number; articles: number; published: number; drafts: number; views: number }>(
    `SELECT (SELECT count(*)::int FROM channels) AS channels,
            count(*)::int AS articles,
            count(*) FILTER (WHERE status = 'published')::int AS published,
            count(*) FILTER (WHERE status = 'draft')::int AS drafts,
            COALESCE(sum(views), 0)::float8 AS views
     FROM articles`,
  );
  return r;
}
