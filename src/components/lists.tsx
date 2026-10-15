import Link from "next/link";
import type { Article } from "@/lib/types";
import { articleUrl, channelUrl, type ChannelMap } from "@/lib/urls";
import { formatDate, formatMd } from "@/lib/markdown";
import { formatMinutes, totalMinutes } from "@/lib/recipe";

export { toChannelMap } from "@/lib/urls";

function href(a: Article, map: ChannelMap) {
  const c = map.get(a.channelId);
  return c ? articleUrl(a, c) : "#";
}

const placeholderBg = [
  "linear-gradient(135deg,#ffd1dc,#ff9fb8)",
  "linear-gradient(135deg,#ffe0e9,#f7a8c4)",
  "linear-gradient(135deg,#fde2f3,#f4a6d7)",
  "linear-gradient(135deg,#ffe4e1,#ffb3a7)",
];

/** 封面图；没有封面时显示粉色渐变 + 分类图标 */
export function Cover({ a, icon, className = "cover" }: { a: Article; icon?: string; className?: string }) {
  if (a.cover) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={className} src={a.cover} alt={a.title} loading="lazy" />;
  }
  return (
    <span className={`${className} cover-ph`} style={{ background: placeholderBg[a.id % placeholderBg.length] }} aria-hidden="true">
      <span>{icon ?? "🍽️"}</span>
    </span>
  );
}

/** 菜谱卡片网格（美食站主力展示形式） */
export function RecipeGrid({ items, map, cols = 4 }: { items: Article[]; map: ChannelMap; cols?: 3 | 4 }) {
  return (
    <ul className={`recipe-grid cols-${cols}`}>
      {items.map((a) => {
        const c = map.get(a.channelId);
        return (
          <li key={a.id}>
            <Link href={href(a, map)} className="recipe-card">
              <Cover a={a} icon={c?.icon} />
              <span className="recipe-card-body">
                <strong>{a.shortTitle || a.title}</strong>
                {a.recipe ? (
                  <span className="recipe-card-meta">
                    <span className={`diff diff-${a.recipe.difficulty}`}>{a.recipe.difficulty}</span>
                    <span>⏱ {formatMinutes(totalMinutes(a.recipe))}</span>
                    <span>👀 {a.views}</span>
                  </span>
                ) : (
                  <span className="recipe-card-meta">{c?.name}</span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** 密集标题列表 */
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
            <Link href={href(a, map)} className="thumb" tabIndex={-1} aria-hidden="true">
              <Cover a={a} icon={c?.icon} />
            </Link>
            <div>
              <h3><Link href={href(a, map)}>{a.title}</Link></h3>
              <p>{a.summary}</p>
              <div className="meta">
                {c && <Link href={channelUrl(c)}>{c.name}</Link>}
                {a.recipe && <span>难度：{a.recipe.difficulty}</span>}
                {a.recipe && <span>耗时：{formatMinutes(totalMinutes(a.recipe))}</span>}
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
