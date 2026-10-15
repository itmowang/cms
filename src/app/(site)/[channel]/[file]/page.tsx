import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ChannelListView } from "@/components/ChannelListView";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumb, RankList, TitleList, toChannelMap } from "@/components/lists";
import { ViewBeacon } from "@/components/ViewBeacon";
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
      title: `${channel.name}频道_第${r.page}页`,
      description: channel.description,
      alternates: { canonical: channelUrl(channel, r.page) },
    };
  }

  const a = r.article;
  const url = articleUrl(a, channel);
  const description = (a.summary || markdownToText(a.content)).slice(0, 150);
  return {
    title: `${a.title}_${channel.name}`,
    description,
    keywords: a.tags,
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
  const [settings, channels, related, adjacent, hot, latest] = await Promise.all([
    getSettings(),
    listChannels(),
    relatedArticles(a, 8),
    adjacentArticles(a),
    hotArticles(10, channel.id),
    latestArticles(10),
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
      <Breadcrumb items={[crumbs[0], crumbs[1], { name: "正文" }]} />

      <div className="layout-2col">
        <article className="col-main article" itemScope itemType="https://schema.org/NewsArticle">
          <header>
            <h1 itemProp="headline">{a.title}</h1>
            <div className="article-meta">
              <time dateTime={a.publishedAt} itemProp="datePublished">{formatDate(a.publishedAt)}</time>
              <span>来源：{a.source}</span>
              <span itemProp="author" itemScope itemType="https://schema.org/Person">
                作者：<span itemProp="name">{a.author}</span>
              </span>
              <meta itemProp="dateModified" content={a.updatedAt} />
            </div>
          </header>

          {a.summary && (
            <section className="article-summary" aria-label="内容摘要">
              <strong>摘要：</strong>
              <span itemProp="description">{a.summary}</span>
            </section>
          )}

          {a.cover && (
            <figure className="article-cover">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.cover} alt={a.title} itemProp="image" />
            </figure>
          )}

          <div className="article-body" itemProp="articleBody" dangerouslySetInnerHTML={{ __html: html }} />

          {a.tags.length > 0 && (
            <div className="article-tags">
              标签：
              {a.tags.map((t) => (
                <Link key={t} href={tagUrl(t)} rel="tag">{t}</Link>
              ))}
            </div>
          )}

          <p className="article-source-note">
            本文地址：<a href={absUrl(articleUrl(a, channel))}>{absUrl(articleUrl(a, channel))}</a>
            {" · "}
            <a href={articleMdUrl(a, channel)} type="text/markdown">纯文本版（Markdown）</a>
          </p>

          <nav className="article-adjacent" aria-label="上一篇 / 下一篇">
            <div>上一篇：{adjacent.newer ? <Link href={articleUrl(adjacent.newer, channel)}>{adjacent.newer.title}</Link> : "没有了"}</div>
            <div>下一篇：{adjacent.older ? <Link href={articleUrl(adjacent.older, channel)}>{adjacent.older.title}</Link> : "没有了"}</div>
          </nav>

          {related.length > 0 && (
            <section className="box">
              <h2 className="box-title"><span>相关阅读</span></h2>
              <TitleList items={related} map={map} />
            </section>
          )}
        </article>

        <aside className="col-side">
          <RankList items={hot} map={map} title={`${channel.name}热点`} />
          <section className="box">
            <h2 className="box-title"><span>最新资讯</span></h2>
            <TitleList items={latest} map={map} showDate={false} />
          </section>
        </aside>
      </div>
    </>
  );
}
