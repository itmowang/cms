import "server-only";
import { revalidatePath } from "next/cache";
import { pushUrls } from "./push";
import * as repo from "./repo";
import { DIFFICULTIES } from "./recipe";
import type { Article, ArticleStatus, Channel, FriendLink, RecipeInfo, SiteSettings } from "./types";
import { absUrl, articleUrl, RESERVED_SLUGS } from "./urls";

/**
 * 业务服务层：后台表单（Server Actions）与 MCP 共用同一套校验与副作用，
 * 保证无论从哪个入口改数据，规则、缓存刷新、搜索引擎推送都一致。
 */

export class ValidationError extends Error {}

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** 内容变更后刷新所有 ISR 静态页（首页、频道、文章、sitemap、rss、llms.txt） */
export function refreshSite() {
  revalidatePath("/", "layout");
}

/** 解析发布时间：支持 ISO 字符串，或不带时区的 "YYYY-MM-DDTHH:mm"（按北京时间） */
export function parsePublishTime(v: string | undefined): string {
  if (!v) return new Date().toISOString();
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(v);
  const d = new Date(hasTz ? v : `${v.length === 16 ? `${v}:00` : v}+08:00`);
  if (Number.isNaN(d.getTime())) throw new ValidationError(`发布时间格式不正确：${v}`);
  return d.toISOString();
}

export const parseTags = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : String(v ?? "").split(/[,，\s]+/))
    .map((t) => t.trim().slice(0, 20))
    .filter(Boolean)
    .slice(0, 10);

/* ---------------- 文章 ---------------- */

export interface ArticleFields {
  title?: string;
  shortTitle?: string;
  channelId?: number;
  summary?: string;
  content?: string;
  cover?: string;
  author?: string;
  source?: string;
  tags?: string[] | string;
  isHeadline?: boolean;
  isFocus?: boolean;
  status?: ArticleStatus;
  publishedAt?: string;
  /** 传 null 表示清除菜谱信息（变为普通文章） */
  recipe?: Partial<RecipeInfo> | null;
}

const clampInt = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

/** 校验并规范化菜谱字段；局部更新时与旧值合并 */
export function normalizeRecipe(input: Partial<RecipeInfo> | null | undefined, old?: RecipeInfo): RecipeInfo | undefined {
  if (input === null) return undefined;
  if (input === undefined) return old;
  const m = { ...old, ...input };
  const ingredients = (m.ingredients ?? [])
    .map((i) => ({ name: clip(i?.name, 30), amount: clip(i?.amount, 30) || "适量" }))
    .filter((i) => i.name)
    .slice(0, 50);
  const steps = (m.steps ?? []).map((s) => clip(s, 1000)).filter(Boolean).slice(0, 50);
  if (!ingredients.length) throw new ValidationError("菜谱至少需要 1 种食材");
  if (!steps.length) throw new ValidationError("菜谱至少需要 1 个做法步骤");
  const difficulty = DIFFICULTIES.includes(m.difficulty as RecipeInfo["difficulty"]) ? (m.difficulty as RecipeInfo["difficulty"]) : "简单";
  return {
    difficulty,
    prepMinutes: clampInt(m.prepMinutes, 0, 6000),
    cookMinutes: clampInt(m.cookMinutes, 0, 6000),
    servings: clip(m.servings, 20) || "2人份",
    flavor: clip(m.flavor, 20) || undefined,
    ingredients,
    steps,
    tips: clip(m.tips, 1000) || undefined,
  };
}

/**
 * 新建（无 id）或局部更新（有 id，只覆盖传入的字段）文章。
 * 发布状态的文章会自动刷新缓存并推送给搜索引擎。
 */
export async function upsertArticle(id: number | undefined, f: ArticleFields): Promise<{ article: Article; url?: string; push: string[] }> {
  const old = id ? await repo.adminGetArticle(id) : undefined;
  if (id && !old) throw new ValidationError(`文章 ${id} 不存在`);

  const title = clip(f.title ?? old?.title, 120);
  const channelId = Number(f.channelId ?? old?.channelId);
  if (!title) throw new ValidationError("标题不能为空");
  if (!Number.isInteger(channelId) || !(await repo.getChannelById(channelId))) throw new ValidationError("频道不存在，请先调用 list_channels 获取有效 channelId");

  const cover = clip(f.cover ?? old?.cover, 500);
  if (cover && !/^(https?:\/\/|\/)/.test(cover)) throw new ValidationError("封面图地址必须以 http(s):// 或 / 开头");

  const article = await repo.saveArticle({
    id,
    title,
    shortTitle: clip(f.shortTitle ?? old?.shortTitle, 40) || undefined,
    channelId,
    summary: clip(f.summary ?? old?.summary, 500),
    content: String(f.content ?? old?.content ?? "").slice(0, 200_000),
    cover: cover || undefined,
    author: clip(f.author ?? old?.author, 50) || "粉厨小编",
    source: clip(f.source ?? old?.source, 50) || "本站",
    tags: f.tags !== undefined ? parseTags(f.tags) : old?.tags ?? [],
    isHeadline: f.isHeadline ?? old?.isHeadline ?? false,
    isFocus: f.isFocus ?? old?.isFocus ?? false,
    status: f.status ?? old?.status ?? "draft",
    publishedAt: f.publishedAt !== undefined ? parsePublishTime(f.publishedAt) : old?.publishedAt ?? new Date().toISOString(),
    recipe: normalizeRecipe(f.recipe, old?.recipe),
  });

  refreshSite();
  const channel = await repo.getChannelById(article.channelId);
  const url = channel ? absUrl(articleUrl(article, channel)) : undefined;
  const push = article.status === "published" && url ? await pushUrls([url]) : [];
  return { article, url, push };
}

export async function removeArticle(id: number): Promise<Article> {
  const a = await repo.deleteArticle(id);
  if (!a) throw new ValidationError(`文章 ${id} 不存在`);
  refreshSite();
  return a;
}

/* ---------------- 频道 ---------------- */

export interface ChannelFields {
  slug?: string;
  name?: string;
  description?: string;
  keywords?: string;
  sort?: number;
  showInNav?: boolean;
  icon?: string;
}

export async function upsertChannel(id: number | undefined, f: ChannelFields): Promise<Channel> {
  const old = id ? await repo.getChannelById(id) : undefined;
  if (id && !old) throw new ValidationError(`频道 ${id} 不存在`);

  const slug = clip(f.slug ?? old?.slug, 30).toLowerCase();
  const name = clip(f.name ?? old?.name, 20);
  if (!name) throw new ValidationError("频道名称不能为空");
  if (!/^[a-z][a-z0-9-]{1,29}$/.test(slug)) throw new ValidationError("目录名只能是小写字母开头的字母、数字、横线，2-30 位");
  if (RESERVED_SLUGS.has(slug)) throw new ValidationError(`目录名 ${slug} 为系统保留`);

  try {
    const channel = await repo.saveChannel({
      id,
      slug,
      name,
      description: clip(f.description ?? old?.description, 300),
      keywords: clip(f.keywords ?? old?.keywords, 200),
      sort: Number.isFinite(f.sort) ? Number(f.sort) : old?.sort ?? 99,
      showInNav: f.showInNav ?? old?.showInNav ?? true,
      icon: clip(f.icon ?? old?.icon, 8) || undefined,
    });
    refreshSite();
    return channel;
  } catch (e) {
    throw new ValidationError((e as Error).message);
  }
}

export async function removeChannel(id: number): Promise<void> {
  try {
    await repo.deleteChannel(id);
  } catch (e) {
    throw new ValidationError((e as Error).message);
  }
  refreshSite();
}

/* ---------------- 站点设置 ---------------- */

export interface SettingsFields {
  name?: string;
  logoText?: string;
  slogan?: string;
  description?: string;
  keywords?: string;
  icp?: string;
  copyright?: string;
  friendLinks?: FriendLink[];
}

export async function patchSettings(f: SettingsFields): Promise<SiteSettings> {
  const limits: Record<Exclude<keyof SettingsFields, "friendLinks">, number> = {
    name: 50, logoText: 20, slogan: 50, description: 300, keywords: 200, icp: 50, copyright: 100,
  };
  const patch: Partial<SiteSettings> = {};
  for (const [k, max] of Object.entries(limits) as Array<[keyof typeof limits, number]>) {
    if (f[k] !== undefined) patch[k] = clip(f[k], max);
  }
  if (patch.name === "") throw new ValidationError("站点名称不能为空");
  if (f.friendLinks) {
    patch.friendLinks = f.friendLinks
      .map((l) => ({ name: clip(l.name, 30), url: clip(l.url, 300) }))
      .filter((l) => l.name && /^https?:\/\//.test(l.url));
  }
  await repo.updateSettings(patch);
  refreshSite();
  return repo.getSettings();
}
