import Link from "next/link";
import type { Metadata } from "next";
import { FocusSlider } from "@/components/FocusSlider";
import { JsonLd } from "@/components/JsonLd";
import { RankList, TitleList, toChannelMap } from "@/components/lists";
import { focusArticles, getSettings, headlineArticles, hotArticles, latestArticles, listChannels } from "@/lib/repo";
import { itemListLd, websiteLd } from "@/lib/seo";
import { articleUrl, channelUrl } from "@/lib/urls";

// ISR：首页静态化，每 60 秒后台增量更新；后台发布文章时也会主动刷新
export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [settings, channels, headlines, focus, latest, hot] = await Promise.all([
    getSettings(),
    listChannels(),
    headlineArticles(3),
    focusArticles(5),
    latestArticles(16),
    hotArticles(10),
  ]);
  const map = toChannelMap(channels);
  const blocks = await Promise.all(channels.map(async (c) => ({ c, items: await latestArticles(9, c.id) })));

  return (
    <>
      <JsonLd data={websiteLd(settings)} />
      <JsonLd data={itemListLd("头条新闻", headlines.map((a) => ({ a, c: map.get(a.channelId)! })))} />
      <h1 className="sr-only">{settings.name} - {settings.slogan}</h1>

      <div className="home-top">
        <div className="col-focus">
          <FocusSlider
            slides={focus.map((a) => {
              const c = map.get(a.channelId)!;
              return { href: articleUrl(a, c), title: a.title, cover: a.cover, channel: c.name };
            })}
          />
        </div>

        <div className="col-headline">
          <section aria-labelledby="hl-title">
            <h2 id="hl-title" className="sr-only">头条</h2>
            {headlines.map((a) => (
              <article key={a.id} className="headline">
                <h3><Link href={articleUrl(a, map.get(a.channelId)!)}>{a.title}</Link></h3>
                <p>{a.summary}</p>
              </article>
            ))}
          </section>
          <section className="box">
            <h2 className="box-title"><span>最新资讯</span></h2>
            <TitleList items={latest} map={map} />
          </section>
        </div>

        <aside className="col-side">
          <RankList items={hot} map={map} />
        </aside>
      </div>

      <div className="channel-blocks">
        {blocks.filter((b) => b.items.length).map(({ c, items }) => {
          const [first, ...rest] = items;
          return (
            <section key={c.id} className="box channel-block" aria-labelledby={`cb-${c.id}`}>
              <h2 className="box-title" id={`cb-${c.id}`}>
                <Link href={channelUrl(c)}>{c.name}</Link>
                <Link href={channelUrl(c)} className="more">更多&gt;&gt;</Link>
              </h2>
              <article className="block-first">
                <h3><Link href={articleUrl(first, c)}>{first.title}</Link></h3>
                <p>{first.summary}</p>
              </article>
              <TitleList items={rest} map={map} showDate={false} />
            </section>
          );
        })}
      </div>
    </>
  );
}
