import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumb, RankList, SummaryList, toChannelMap } from "@/components/lists";
import { allTags, articlesByTag, hotArticles, listChannels } from "@/lib/repo";
import { breadcrumbLd } from "@/lib/seo";
import { parseTagFile, tagUrl } from "@/lib/urls";

export const revalidate = 300;

type Props = { params: Promise<{ name: string }> };

export async function generateStaticParams() {
  return (await allTags()).map((t) => ({ name: `${t}.html` }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = parseTagFile((await params).name);
  if (!tag) return {};
  return {
    title: `${tag}相关新闻`,
    description: `关于「${tag}」的最新新闻、资讯与深度报道。`,
    keywords: [tag],
    alternates: { canonical: tagUrl(tag) },
  };
}

export default async function TagPage({ params }: Props) {
  const tag = parseTagFile((await params).name);
  if (!tag) notFound();
  const [items, channels, hot] = await Promise.all([articlesByTag(tag), listChannels(), hotArticles(10)]);
  if (!items.length) notFound();
  const map = toChannelMap(channels);
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "首页", url: "/" }, { name: tag, url: tagUrl(tag) }])} />
      <Breadcrumb items={[{ name: "首页", url: "/" }, { name: `标签：${tag}` }]} />
      <div className="layout-2col">
        <div className="col-main">
          <header className="channel-head">
            <h1>{tag}</h1>
            <p>共 {items.length} 篇相关报道</p>
          </header>
          <SummaryList items={items} map={map} />
        </div>
        <aside className="col-side">
          <RankList items={hot} map={map} />
        </aside>
      </div>
    </>
  );
}
