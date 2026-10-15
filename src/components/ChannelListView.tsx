import { JsonLd } from "./JsonLd";
import { Breadcrumb, Pagination, RankList, SummaryList, TagCloud, TitleList, toChannelMap } from "./lists";
import { hotArticles, latestArticles, listChannels, pagedChannelArticles, topTags } from "@/lib/repo";
import { breadcrumbLd, itemListLd } from "@/lib/seo";
import type { Channel } from "@/lib/types";
import { channelUrl } from "@/lib/urls";
import { notFound } from "next/navigation";

export async function ChannelListView({ channel, page }: { channel: Channel; page: number }) {
  const [{ items, totalPages, total }, channels, hot, latest, tags] = await Promise.all([
    pagedChannelArticles(channel.id, page),
    listChannels(),
    hotArticles(10, channel.id),
    latestArticles(10),
    topTags(20),
  ]);
  if (page > totalPages) notFound();
  const map = toChannelMap(channels);
  const crumbs = [
    { name: "首页", url: "/" },
    { name: channel.name, url: channelUrl(channel) },
  ];

  return (
    <>
      <JsonLd data={breadcrumbLd(crumbs)} />
      <JsonLd data={itemListLd(`${channel.name}菜谱`, items.map((a) => ({ a, c: channel })))} />
      <Breadcrumb items={page > 1 ? [...crumbs, { name: `第 ${page} 页` }] : [crumbs[0], { name: channel.name }]} />
      <div className="layout-2col">
        <div className="col-main">
          <header className="channel-head">
            <h1>{channel.name}做法大全{page > 1 && <small>（第 {page} 页）</small>}</h1>
            <p>{channel.description}共收录 {total} 道菜谱。</p>
          </header>
          {items.length ? <SummaryList items={items} map={map} /> : <p className="empty">该分类下暂无菜谱。</p>}
          <Pagination page={page} totalPages={totalPages} urlOf={(p) => channelUrl(channel, p)} />
        </div>
        <aside className="col-side">
          <RankList items={hot} map={map} title={`${channel.name}排行`} />
          <section className="box">
            <h2 className="box-title"><span>全站最新</span></h2>
            <TitleList items={latest} map={map} showDate={false} />
          </section>
          <TagCloud tags={tags} />
        </aside>
      </div>
    </>
  );
}
