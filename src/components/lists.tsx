import Link from "next/link";
import type { Article } from "@/lib/types";
import { articleUrl, channelUrl, type ChannelMap } from "@/lib/urls";
import { formatDate, formatMd } from "@/lib/markdown";

export { toChannelMap } from "@/lib/urls";

function href(a: Article, map: ChannelMap) {
  const c = map.get(a.channelId);
  return c ? articleUrl(a, c) : "#";
}

/** 门户风格密集标题列表 */
export function TitleList({ items, map, showDate = true, short = false }: { items: Article[]; map: ChannelMap; showDate?: boolean; short?: boolean }) {
  return (
    <ul className="title-list">
      {items.map((a) => (
        <li key={a.id}>
          <Link href={href(a, map)} title={a.title}>{short && a.shortTitle ? a.shortTitle : a.title}</Link>
          {showDate && <time dateTime={a.publishedAt}>{formatMd(a.publishedAt)}</time>}
        </li>
      ))}
    </ul>
  );
}

/** 排行榜（带序号） */
export function RankList({ items, map, title = "热点排行" }: { items: Article[]; map: ChannelMap; title?: string }) {
  return (
    <section className="box">
      <h2 className="box-title"><span>{title}</span></h2>
      <ol className="rank-list">
        {items.map((a, i) => (
          <li key={a.id}>
            <em className={i < 3 ? "top" : undefined}>{i + 1}</em>
            <Link href={href(a, map)} title={a.title}>{a.title}</Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** 频道列表页条目：标题 + 摘要 + 元信息 */
export function SummaryList({ items, map }: { items: Article[]; map: ChannelMap }) {
  return (
    <ul className="summary-list">
      {items.map((a) => {
        const c = map.get(a.channelId);
        return (
          <li key={a.id}>
            {a.cover && (
              <Link href={href(a, map)} className="thumb" tabIndex={-1} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.cover} alt="" loading="lazy" />
              </Link>
            )}
            <div>
              <h3><Link href={href(a, map)}>{a.title}</Link></h3>
              <p>{a.summary}</p>
              <div className="meta">
                {c && <Link href={channelUrl(c)}>{c.name}</Link>}
                <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>
                <span>{a.source}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function Breadcrumb({ items }: { items: Array<{ name: string; url?: string }> }) {
  return (
    <nav className="breadcrumb" aria-label="当前位置">
      您的位置：
      {items.map((it, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden="true"> &gt; </span>}
          {it.url ? <Link href={it.url}>{it.name}</Link> : <span aria-current="page">{it.name}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Pagination({ page, totalPages, urlOf }: { page: number; totalPages: number; urlOf: (p: number) => string }) {
  if (totalPages <= 1) return null;
  const pages: number[] = [];
  const start = Math.max(1, page - 4);
  const end = Math.min(totalPages, start + 8);
  for (let p = start; p <= end; p++) pages.push(p);
  return (
    <nav className="pagination" aria-label="分页">
      {page > 1 && <Link href={urlOf(1)}>首页</Link>}
      {page > 1 && <Link href={urlOf(page - 1)} rel="prev">上一页</Link>}
      {pages.map((p) =>
        p === page ? (
          <span key={p} className="current" aria-current="page">{p}</span>
        ) : (
          <Link key={p} href={urlOf(p)}>{p}</Link>
        ),
      )}
      {page < totalPages && <Link href={urlOf(page + 1)} rel="next">下一页</Link>}
      {page < totalPages && <Link href={urlOf(totalPages)}>末页</Link>}
      <span className="total">共 {totalPages} 页</span>
    </nav>
  );
}
