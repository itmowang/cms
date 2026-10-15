import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ChannelListView } from "@/components/ChannelListView";
import { ArticleView } from "@/components/ArticleView";
import { toChannelMap } from "@/components/lists";
import { formatMinutes, totalMinutes } from "@/lib/recipe";
import { markdownToText } from "@/lib/markdown";
import { getChannelById, getChannelBySlug, getPublishedArticle, latestArticles, listChannels } from "@/lib/repo";
import type { Article, Channel } from "@/lib/types";
import { articleMdUrl, articleUrl, channelUrl, parseChannelFile } from "@/lib/urls";

export const revalidate = 300;

type Props = { params: Promise<{ channel: string; file: string }> };

/** 构建时预渲染最近 500 篇文章，其余首次访问时生成并缓存（ISR） */
export async function generateStaticParams() {
  const [articles, channels] = await Promise.all([latestArticles(500), listChannels()]);
  const map = toChannelMap(channels);
  return articles
    .filter((a) => map.has(a.channelId))
    .map((a) => ({ channel: map.get(a.channelId)!.slug, file: `${a.id}.html` }));
}

type Resolved =
  | { kind: "article"; channel: Channel; article: Article }
  | { kind: "list"; channel: Channel; page: number }
  | { kind: "redirect"; to: string };

async function resolve(params: Props["params"]): Promise<Resolved | null> {
  const { channel: slug, file } = await params;
  const parsed = parseChannelFile(file);
  const channel = await getChannelBySlug(slug);
  if (!parsed || !channel) return null;

  if (parsed.type === "list") {
    // index.html / list_1.html 统一 301 到频道根地址，避免重复内容
    if (parsed.page === 1) return { kind: "redirect", to: channelUrl(channel) };
    return { kind: "list", channel, page: parsed.page };
  }

  const article = await getPublishedArticle(parsed.id);
  if (!article) return null;
  if (article.channelId !== channel.id) {
    // 文章换了频道：旧链接 301 到新地址，保留权重
    const real = await getChannelById(article.channelId);
    return real ? { kind: "redirect", to: articleUrl(article, real) } : null;
  }
  return { kind: "article", channel, article };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await resolve(params);
  if (!r || r.kind === "redirect") return {};
  const { channel } = r;

  if (r.kind === "list") {
    return {
      title: `${channel.name}做法大全_第${r.page}页`,
      description: channel.description,
      alternates: { canonical: channelUrl(channel, r.page) },
    };
  }

  const a = r.article;
  const url = articleUrl(a, channel);
  // 菜谱的 description 带上难度、耗时、主要食材，搜索结果里一眼看到关键信息
  const rp = a.recipe;
  const recipeHint = rp
    ? `【${rp.difficulty}·${formatMinutes(totalMinutes(rp))}·${rp.servings}】主料：${rp.ingredients.slice(0, 4).map((i) => i.name).join("、")}。`
    : "";
  const description = (recipeHint + (a.summary || markdownToText(a.content))).slice(0, 150);
  return {
    title: `${a.title}_${channel.name}`,
    description,
    keywords: rp ? [a.shortTitle || a.title, `${a.shortTitle || a.title}的做法`, ...a.tags] : a.tags,
    authors: [{ name: a.author }],
    alternates: {
      canonical: url,
      types: { "text/markdown": articleMdUrl(a, channel) },
    },
    openGraph: {
      type: "article",
      title: a.title,
      description,
      url,
      publishedTime: a.publishedAt,
      modifiedTime: a.updatedAt,
      section: channel.name,
      tags: a.tags,
      images: a.cover ? [a.cover] : undefined,
    },
    twitter: { card: a.cover ? "summary_large_image" : "summary", title: a.title, description },
    other: {
      // 百度 / 头条等搜索引擎识别的时间因子
      "bytedance:published_time": a.publishedAt,
      "bytedance:updated_time": a.updatedAt,
    },
  };
}

export default async function ChannelFilePage({ params }: Props) {
  const r = await resolve(params);
  if (!r) notFound();
  if (r.kind === "redirect") permanentRedirect(r.to);
  if (r.kind === "list") return <ChannelListView channel={r.channel} page={r.page} />;
  return <ArticleView article={r.article} channel={r.channel} />;
}

