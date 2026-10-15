import type { Metadata } from "next";
import { Breadcrumb, SummaryList, toChannelMap } from "@/components/lists";
import { listChannels, searchArticles } from "@/lib/repo";

// 搜索结果页不让搜索引擎收录，避免产生海量低质页面
export const metadata: Metadata = {
  title: "站内搜索",
  robots: { index: false, follow: true },
};

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export default async function SearchPage({ searchParams }: Props) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").slice(0, 50);
  const [items, channels] = await Promise.all([searchArticles(q), listChannels()]);
  return (
    <>
      <Breadcrumb items={[{ name: "首页", url: "/" }, { name: "搜索" }]} />
      <div className="col-main">
        <header className="channel-head">
          <h1>搜索：{q || "请输入关键词"}</h1>
          {q && <p>找到 {items.length} 条结果</p>}
        </header>
        <form action="/search" method="get" className="search search-inline" role="search">
          <label htmlFor="q2" className="sr-only">关键词</label>
          <input id="q2" name="q" type="search" defaultValue={q} maxLength={50} />
          <button type="submit">搜索</button>
        </form>
        {q && items.length === 0 && <p className="empty">没有找到相关内容，换个关键词试试。</p>}
        <SummaryList items={items} map={toChannelMap(channels)} />
      </div>
    </>
  );
}
