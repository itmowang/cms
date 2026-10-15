import Link from "next/link";
import type { Metadata } from "next";
import { FocusSlider } from "@/components/FocusSlider";
import { JsonLd } from "@/components/JsonLd";
import { Cover, PicList, RankList, TagCloud, TitleList, toChannelMap } from "@/components/lists";
import { formatMinutes, totalMinutes } from "@/lib/recipe";
import { focusArticles, getSettings, headlineArticles, hotArticles, latestArticles, listChannels, topTags } from "@/lib/repo";
import { itemListLd, websiteLd } from "@/lib/seo";
import { articleUrl, channelUrl, tagUrl } from "@/lib/urls";

// ISR：首页静态化，每 60 秒后台增量更新；后台发布菜谱时也会主动刷新
export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [settings, channels, picks, focus, latest, hot, tags] = await Promise.all([
    getSettings(),
    listChannels(),
    headlineArticles(4),
    focusArticles(5),
    latestArticles(14),
    hotArticles(16),
    topTags(24),
  ]);
  const map = toChannelMap(channels);
  const blocks = await Promise.all(channels.map(async (c) => ({ c, items: await latestArticles(7, c.id) })));
  const [lead, ...subPicks] = picks;

  return (
    <>
      <JsonLd data={websiteLd(settings)} />
      <JsonLd data={itemListLd("今日推荐菜谱", picks.map((a) => ({ a, c: map.get(a.channelId)! })))} />
      <h1 className="sr-only">{settings.name} - {settings.slogan}</h1>

      {/* 第一屏：焦点图 | 头条 + 最新 | 排行 */}
      <div className="home-top">
        <div className="col-focus">
          <FocusSlider
            slides={focus.map((a) => {
              const c = map.get(a.channelId)!;
              return { href: articleUrl(a, c), title: a.title, cover: a.cover, channel: c.name };
            })}
          />
          <section className="box focus-under">
            <h2 className="box-title"><span>本周热门</span></h2>
            <TitleList items={hot.slice(2, 12)} map={map} showDate={false} showMeta />
          </section>
        </div>

        <div className="col-headline">
          {lead && (
            <article className="headline">
              <h2><Link href={articleUrl(lead, map.get(lead.channelId)!)}>{lead.title}</Link></h2>
              <p>
                {lead.summary}
                <Link href={articleUrl(lead, map.get(lead.channelId)!)} className="detail">[详细]</Link>
              </p>
            </article>
          )}
          {subPicks.length > 0 && (
            <ul className="sub-headlines">
              {subPicks.map((a) => {
                const c = map.get(a.channelId)!;
                return (
                  <li key={a.id}>
                    <Link href={articleUrl(a, c)}>{a.shortTitle || a.title}</Link>
                  </li>
                );
              })}
            </ul>
          )}
          <section className="box">
            <h2 className="box-title">
              <span>最新菜谱</span>
              <span className="box-sub">每日更新 · 步骤详细</span>
            </h2>
            <TitleList items={latest} map={map} withChannel />
          </section>
        </div>

        <aside className="col-side">
          <RankList items={hot.slice(0, 10)} map={map} title="菜谱排行榜" />
        </aside>
      </div>

      {/* 分类导航条 */}
      <nav className="cat-bar" aria-label="菜谱分类">
        <strong>菜谱分类</strong>
        {channels.map((c) => (
          <Link key={c.id} href={channelUrl(c)}>{c.name}</Link>
        ))}
        <span className="cat-bar-sep" aria-hidden="true">|</span>
        <strong>热门标签</strong>
        {tags.slice(0, 8).map((t) => (
          <Link key={t.tag} href={tagUrl(t.tag)}>{t.tag}</Link>
        ))}
      </nav>

      {/* 图片推荐 */}
      <section className="box">
        <h2 className="box-title"><span>图说美食</span></h2>
        <PicList items={hot.slice(0, 6)} map={map} cols={6} />
      </section>

      {/* 分类区块：每块左图右文 */}
      <div className="channel-blocks">
        {blocks.filter((b) => b.items.length).map(({ c, items }) => {
          const [first, ...rest] = items;
          const r = first.recipe;
          return (
            <section key={c.id} className="box channel-block" aria-labelledby={`cb-${c.id}`}>
              <h2 className="box-title" id={`cb-${c.id}`}>
                <Link href={channelUrl(c)}>{c.name}</Link>
                <Link href={channelUrl(c)} className="more">更多&gt;&gt;</Link>
              </h2>
              <div className="block-first">
                <Link href={articleUrl(first, c)} className="block-pic" tabIndex={-1} aria-hidden="true">
                  <Cover a={first} />
                </Link>
                <div>
                  <h3><Link href={articleUrl(first, c)}>{first.shortTitle || first.title}</Link></h3>
                  {r && <p className="block-meta">{r.difficulty} · {formatMinutes(totalMinutes(r))} · {r.servings}</p>}
                  <p>{first.summary}</p>
                </div>
              </div>
              <TitleList items={rest} map={map} showDate={false} showMeta />
            </section>
          );
        })}
      </div>

      <TagCloud tags={tags} title="热门标签" />
    </>
  );
}
