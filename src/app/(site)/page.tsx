import Link from "next/link";
import type { Metadata } from "next";
import { FocusSlider } from "@/components/FocusSlider";
import { JsonLd } from "@/components/JsonLd";
import { RankList, RecipeGrid, toChannelMap } from "@/components/lists";
import { formatMinutes, totalMinutes } from "@/lib/recipe";
import { focusArticles, getSettings, headlineArticles, hotArticles, latestArticles, listChannels } from "@/lib/repo";
import { itemListLd, websiteLd } from "@/lib/seo";
import { articleUrl, channelUrl } from "@/lib/urls";

// ISR：首页静态化，每 60 秒后台增量更新；后台发布菜谱时也会主动刷新
export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [settings, channels, picks, focus, latest, hot] = await Promise.all([
    getSettings(),
    listChannels(),
    headlineArticles(4),
    focusArticles(5),
    latestArticles(8),
    hotArticles(10),
  ]);
  const map = toChannelMap(channels);
  const blocks = await Promise.all(channels.map(async (c) => ({ c, items: await latestArticles(4, c.id) })));

  return (
    <>
      <JsonLd data={websiteLd(settings)} />
      <JsonLd data={itemListLd("今日推荐菜谱", picks.map((a) => ({ a, c: map.get(a.channelId)! })))} />
      <h1 className="sr-only">{settings.name} - {settings.slogan}</h1>

      <div className="home-top">
        <FocusSlider
          slides={focus.map((a) => {
            const c = map.get(a.channelId)!;
            return { href: articleUrl(a, c), title: a.title, cover: a.cover, channel: c.name, icon: c.icon };
          })}
        />
        <section className="box picks" aria-labelledby="picks-title">
          <h2 className="box-title" id="picks-title"><span>💗 今日推荐</span></h2>
          <ul>
            {picks.map((a) => {
              const c = map.get(a.channelId)!;
              return (
                <li key={a.id}>
                  <Link href={articleUrl(a, c)}>
                    <strong>{a.title}</strong>
                    <span>
                      {c.icon} {c.name}
                      {a.recipe && ` · ${a.recipe.difficulty} · ${formatMinutes(totalMinutes(a.recipe))}`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <nav className="cat-strip" aria-label="菜谱分类">
        {channels.map((c) => (
          <Link key={c.id} href={channelUrl(c)}>
            <span aria-hidden="true">{c.icon ?? "🍽️"}</span>
            {c.name}
          </Link>
        ))}
      </nav>

      <div className="layout-2col">
        <section className="col-main box" aria-labelledby="latest-title">
          <h2 className="box-title" id="latest-title"><span>✨ 最新菜谱</span></h2>
          <RecipeGrid items={latest} map={map} cols={4} />
        </section>
        <aside className="col-side">
          <RankList items={hot} map={map} title="🔥 热门菜谱" />
        </aside>
      </div>

      {blocks.filter((b) => b.items.length).map(({ c, items }) => (
        <section key={c.id} className="box" aria-labelledby={`cb-${c.id}`}>
          <h2 className="box-title" id={`cb-${c.id}`}>
            <Link href={channelUrl(c)}>{c.icon} {c.name}</Link>
            <Link href={channelUrl(c)} className="more">更多{c.name}做法 &gt;</Link>
          </h2>
          <RecipeGrid items={items} map={map} cols={4} />
        </section>
      ))}
    </>
  );
}
