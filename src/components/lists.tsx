import Link from "next/link";
import type { Article } from "@/lib/types";
import { articleUrl, channelUrl, tagUrl, type ChannelMap } from "@/lib/urls";
import { formatDate, formatMd } from "@/lib/markdown";
import { formatMinutes, totalMinutes } from "@/lib/recipe";

export { toChannelMap } from "@/lib/urls";

function href(a: Article, map: ChannelMap) {
  const c = map.get(a.channelId);
  return c ? articleUrl(a, c) : "#";
}

/** 无封面时的占位底色（低饱和食物色，接近门户「暂无图片」占位） */
const phColors = ["#f3e4d7", "#f6e1e7", "#ece5d3", "#e5ecdf", "#f1e2ea", "#f4e9dc"];

/** 封面图；没有封面时显示纯色底 + 菜名 */
export function Cover({ a, className = "cover" }: { a: Article; className?: string }) {
  if (a.cover) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={className} src={a.cover} alt={a.title} loading="lazy" />;
  }
  return (
    <span className={`${className} cover-ph`} style={{ background: phColors[a.id % phColors.length] }} aria-hidden="true">
      <span>{a.shortTitle || a.title}</span>
    </span>
  );
}

/** 图片列表：小图 + 标题，门户「图片频道」式排列 */
export function PicList({ items, map, cols = 4 }: { items: Article[]; map: ChannelMap; cols?: 3 | 4 | 6 }) {
  return (
    <ul className={`pic-list cols-${cols}`}>
      {items.map((a) => (
        <li key={a.id}>
          <Link href={href(a, map)} title={a.title}>
            <Cover a={a} />
            <span className="pic-title">{a.shortTitle || a.title}</span>
          </Link>
          {a.recipe && (
            <span className="pic-meta">
              {a.recipe.difficulty} · {formatMinutes(totalMinutes(a.recipe))}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** 密集标题列表；withChannel 时在标题前加 [分类] */
export function TitleList({
  items,
  map,
  showDate = true,
  withChannel = false,
  showMeta = false,
}: {
  items: Article[];
  map: ChannelMap;
  showDate?: boolean;
  withChannel?: boolean;
  /** 右侧显示难度 / 耗时代替日期 */
  showMeta?: boolean;
}) {
  return (
    <ul className="title-list">
      {items.map((a) => {
        const c = map.get(a.channelId);
        return (
          <li key={a.id}>
            {withChannel && c && (
              <Link href={channelUrl(c)} className="tl-cat">[{c.name}]</Link>
            )}
            <Link href={href(a, map)} title={a.title} className="tl-title">{a.title}</Link>
            {showMeta && a.recipe ? (
              <span className="tl-side">{a.recipe.difficulty}·{formatMinutes(totalMinutes(a.recipe))}</span>
            ) : (
              showDate && <time className="tl-side" dateTime={a.publishedAt}>{formatMd(a.publishedAt)}</time>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** 排行榜（带序号，前三名高亮） */
export function RankList({ items, map, title = "热门菜谱排行" }: { items: Article[]; map: ChannelMap; title?: string }) {
  return (
    <section className="box">
      <h2 className="box-title"><span>{title}</span></h2>
      <ol className="rank-list">
        {items.map((a, i) => (
          <li key={a.id}>
            <em className={i < 3 ? "top" : undefined}>{i + 1}</em>
            <Link href={href(a, map)} title={a.title}>{a.title}</Link>
            <span className="rank-views">{a.views}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** 标签云 */
export function TagCloud({ tags, title = "热门标签" }: { tags: Array<{ tag: string; count: number }>; title?: string }) {
  return (
    <section className="box">
      <h2 className="box-title"><span>{title}</span></h2>
      <div className="tag-cloud">
        {tags.map(({ tag, count }) => (
          <Link key={tag} href={tagUrl(tag)} title={`${count} 道菜谱`}>{tag}</Link>
        ))}
      </div>
    </section>
  );
}

/** 列表页条目：小图 + 标题 + 摘要 + 菜谱信息 */
export function SummaryList({ items, map }: { items: Article[]; map: ChannelMap }) {
  return (
    <ul className="summary-list">
      {items.map((a) => {
        const c = map.get(a.channelId);
        const r = a.recipe;
        return (
          <li key={a.id}>
            <Link href={href(a, map)} className="thumb" tabIndex={-1} aria-hidden="true">
              <Cover a={a} />
            </Link>
            <div className="summary-body">
              <h3><Link href={href(a, map)}>{a.title}</Link></h3>
              {r && (
                <p className="summary-ing">
                  主料：{r.ingredients.slice(0, 5).map((i) => i.name).join("、")}
                </p>
              )}
              <p className="summary-text">{a.summary}</p>
              <div className="meta">
                {c && <Link href={channelUrl(c)}>{c.name}</Link>}
                {r && <span>难度：{r.difficulty}</span>}
                {r && <span>耗时：{formatMinutes(totalMinutes(r))}</span>}
                {r?.flavor && <span>口味：{r.flavor}</span>}
                <span>浏览：{a.views}</span>
                <time dateTime={a.publishedAt}>{formatDate(a.publishedAt, false)}</time>
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
      当前位置：
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
