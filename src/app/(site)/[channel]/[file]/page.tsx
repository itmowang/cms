import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ChannelListView } from "@/components/ChannelListView";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumb, Cover, RankList, RecipeGrid, toChannelMap } from "@/components/lists";
import { RecipeView } from "@/components/RecipeView";
import { ViewBeacon } from "@/components/ViewBeacon";
import { formatMinutes, totalMinutes } from "@/lib/recipe";
import { formatDate, markdownToText, renderMarkdown } from "@/lib/markdown";
import {
  adjacentArticles,
  getChannelById,
  getChannelBySlug,
  getPublishedArticle,
  getSettings,
  hotArticles,
  latestArticles,
  listChannels,
  relatedArticles,
} from "@/lib/repo";
import { articleLd, breadcrumbLd } from "@/lib/seo";
import type { Article, Channel } from "@/lib/types";
import { absUrl, articleMdUrl, articleUrl, channelUrl, parseChannelFile, tagUrl } from "@/lib/urls";

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


async function ArticleView({ article: a, channel }: { article: Article; channel: Channel }) {
  const [settings, channels, related, adjacent, hot] = await Promise.all([
    getSettings(),
    listChannels(),
    relatedArticles(a, 6),
    adjacentArticles(a),
    hotArticles(10, channel.id),
  ]);
  const map = toChannelMap(channels);
  const html = renderMarkdown(a.content);
  const crumbs = [
    { name: "首页", url: "/" },
    { name: channel.name, url: channelUrl(channel) },
    { name: a.title, url: articleUrl(a, channel) },
  ];

  return (
    <>
      <JsonLd data={articleLd(a, channel, settings)} />
      <JsonLd data={breadcrumbLd(crumbs)} />
      <ViewBeacon id={a.id} />
      <Breadcrumb items={[crumbs[0], crumbs[1], { name: a.shortTitle || a.title }]} />

      <div className="layout-2col">
        <article className="col-main article">
          <header>
            <h1>{a.title}</h1>
            <div className="article-meta">
              <span>👩‍🍳 {a.author}</span>
              <time dateTime={a.publishedAt}>{formatDate(a.publishedAt, false)}</time>
              <span>👀 {a.views} 人看过</span>
            </div>
          </header>

          <figure className="article-cover">
            <Cover a={a} icon={channel.icon} className="cover big" />
          </figure>

          {a.summary && <p className="article-summary">{a.summary}</p>}

          {a.recipe && <RecipeView recipe={a.recipe} />}

          {a.content.trim() && (
            <section className="recipe-section">
              {a.recipe && <h2>📖 关于这道菜</h2>}
              <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />
            </section>
          )}

          {a.tags.length > 0 && (
            <div className="article-tags">
              {a.tags.map((t) => (
                <Link key={t} href={tagUrl(t)} rel="tag">#{t}</Link>
              ))}
            </div>
          )}

          <p className="article-source-note">
            本文地址：<a href={absUrl(articleUrl(a, channel))}>{absUrl(articleUrl(a, channel))}</a>
            {" · "}
            <a href={articleMdUrl(a, channel)} type="text/markdown">纯文本菜谱（Markdown）</a>
          </p>

          <nav className="article-adjacent" aria-label="上一道 / 下一道">
            <div>上一道：{adjacent.newer ? <Link href={articleUrl(adjacent.newer, channel)}>{adjacent.newer.title}</Link> : "没有了"}</div>
            <div>下一道：{adjacent.older ? <Link href={articleUrl(adjacent.older, channel)}>{adjacent.older.title}</Link> : "没有了"}</div>
          </nav>

          {related.length > 0 && (
            <section className="box">
              <h2 className="box-title"><span>🍽️ 相关菜谱</span></h2>
              <RecipeGrid items={related} map={map} cols={3} />
            </section>
          )}
        </article>

        <aside className="col-side">
          <RankList items={hot} map={map} title={`🔥 ${channel.name}热门`} />
        </aside>
      </div>
    </>
  );
}
