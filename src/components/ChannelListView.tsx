import { JsonLd } from "./JsonLd";
import { Breadcrumb, Pagination, RankList, SummaryList, toChannelMap } from "./lists";
import { hotArticles, listChannels, pagedChannelArticles } from "@/lib/repo";
import { breadcrumbLd, itemListLd } from "@/lib/seo";
import type { Channel } from "@/lib/types";
import { channelUrl } from "@/lib/urls";
import { notFound } from "next/navigation";

export async function ChannelListView({ channel, page }: { channel: Channel; page: number }) {
  const [{ items, totalPages }, channels, hot] = await Promise.all([
    pagedChannelArticles(channel.id, page),
    listChannels(),
    hotArticles(10, channel.id),
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
      <JsonLd data={itemListLd(`${channel.name}频道`, items.map((a) => ({ a, c: channel })))} />
      <Breadcrumb items={page > 1 ? [...crumbs, { name: `第 ${page} 页` }] : [crumbs[0], { name: channel.name }]} />
      <div className="layout-2col">
        <div className="col-main">
          <header className="channel-head">
            <h1>{channel.name}{page > 1 && <small>（第 {page} 页）</small>}</h1>
            <p>{channel.description}</p>
          </header>
          <SummaryList items={items} map={map} />
          <Pagination page={page} totalPages={totalPages} urlOf={(p) => channelUrl(channel, p)} />
        </div>
        <aside className="col-side">
          <RankList items={hot} map={map} title={`${channel.name}排行`} />
        </aside>
      </div>
    </>
  );
}
