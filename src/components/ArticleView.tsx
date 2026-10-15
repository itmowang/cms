import Link from "next/link";
import { JsonLd } from "./JsonLd";
import { Breadcrumb, Cover, PicList, RankList, TagCloud, TitleList, toChannelMap } from "./lists";
import { RecipeView } from "./RecipeView";
import { ViewBeacon } from "./ViewBeacon";
import { formatDate, renderMarkdown } from "@/lib/markdown";
import { adjacentArticles, getSettings, hotArticles, latestArticles, listChannels, relatedArticles, topTags } from "@/lib/repo";
import { articleLd, breadcrumbLd } from "@/lib/seo";
import type { Article, Channel } from "@/lib/types";
import { absUrl, articleMdUrl, articleUrl, channelUrl, tagUrl } from "@/lib/urls";

/** 菜谱 / 文章详情页（门户正文页排版） */
export async function ArticleView({ article: a, channel }: { article: Article; channel: Channel }) {
  const [settings, channels, related, adjacent, hot, latest, tags] = await Promise.all([
    getSettings(),
    listChannels(),
    relatedArticles(a, 10),
    adjacentArticles(a),
    hotArticles(10, channel.id),
    latestArticles(8),
    topTags(20),
  ]);
  const map = toChannelMap(channels);
  const html = renderMarkdown(a.content);
  const url = articleUrl(a, channel);
  const crumbs = [
    { name: "首页", url: "/" },
    { name: channel.name, url: channelUrl(channel) },
    { name: a.title, url },
  ];

  return (
    <>
      <JsonLd data={articleLd(a, channel, settings)} />
      <JsonLd data={breadcrumbLd(crumbs)} />
      <ViewBeacon id={a.id} />
      <Breadcrumb items={[crumbs[0], crumbs[1], { name: "正文" }]} />

      <div className="layout-2col">
        <article className="col-main article">
          <header className="article-head">
            <h1>{a.title}</h1>
            <div className="article-meta">
              <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>
              <span>来源：{a.source}</span>
              <span>作者：{a.author}</span>
              <span>浏览：{a.views}</span>
              <Link href={channelUrl(channel)}>{channel.name}</Link>
            </div>
          </header>

          {a.summary && (
            <p className="article-summary">
              <strong>导读：</strong>
              {a.summary}
            </p>
          )}

          {a.cover && (
            <figure className="article-cover">
              <Cover a={a} className="cover big" />
              <figcaption>{a.shortTitle || a.title}成品图</figcaption>
            </figure>
          )}

          {a.recipe && <RecipeView recipe={a.recipe} />}

          {a.content.trim() && (
            <section className="recipe-section">
              {a.recipe && <h2 className="sec-title">菜品介绍</h2>}
              <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />
            </section>
          )}

          {a.tags.length > 0 && (
            <div className="article-tags">
              <strong>标签：</strong>
              {a.tags.map((t) => (
                <Link key={t} href={tagUrl(t)} rel="tag">{t}</Link>
              ))}
            </div>
          )}

          <p className="article-source-note">
            本文地址：<a href={absUrl(url)}>{absUrl(url)}</a>
            {"　"}
            <a href={articleMdUrl(a, channel)} type="text/markdown">纯文本版</a>
          </p>

          <nav className="article-adjacent" aria-label="上一篇 / 下一篇">
            <div>上一篇：{adjacent.newer ? <Link href={articleUrl(adjacent.newer, channel)}>{adjacent.newer.title}</Link> : "没有了"}</div>
            <div>下一篇：{adjacent.older ? <Link href={articleUrl(adjacent.older, channel)}>{adjacent.older.title}</Link> : "没有了"}</div>
          </nav>

          {related.length > 0 && (
            <section className="box">
              <h2 className="box-title"><span>相关菜谱</span></h2>
              <PicList items={related.slice(0, 4)} map={map} cols={4} />
              {related.length > 4 && (
                <div className="two-col-list">
                  <TitleList items={related.slice(4)} map={map} showDate={false} showMeta />
                </div>
              )}
            </section>
          )}
        </article>

        <aside className="col-side">
          <RankList items={hot} map={map} title={`${channel.name}排行`} />
          <section className="box">
            <h2 className="box-title"><span>最新菜谱</span></h2>
            <TitleList items={latest} map={map} showDate={false} />
          </section>
          <TagCloud tags={tags} />
        </aside>
      </div>
    </>
  );
}
