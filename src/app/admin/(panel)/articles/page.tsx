import Link from "next/link";
import { deleteArticleAction } from "../../actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Notice, sp, type AdminSearchParams } from "@/components/admin/Notice";
import { formatDate } from "@/lib/markdown";
import { adminListArticles, listChannels } from "@/lib/repo";
import { articleUrl, toChannelMap } from "@/lib/urls";

export default async function ArticlesPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const q = await searchParams;
  const page = Math.max(1, Number(sp(q.page)) || 1);
  const keyword = sp(q.q) ?? "";
  const channelId = Number(sp(q.channel)) || undefined;
  const [{ items, totalPages, total }, channels] = await Promise.all([
    adminListArticles({ keyword, channelId, page }),
    listChannels(),
  ]);
  const map = toChannelMap(channels);
  const qs = (p: number) => `?${new URLSearchParams({ q: keyword, channel: String(channelId ?? ""), page: String(p) })}`;

  return (
    <>
      <h1>文章管理 <Link href="/admin/articles/new" className="btn primary small">+ 发布文章</Link></h1>
      <Notice error={sp(q.error)} ok={sp(q.ok)} />
      <form className="toolbar" method="get">
        <input name="q" defaultValue={keyword} placeholder="标题关键词" aria-label="标题关键词" />
        <select name="channel" defaultValue={channelId ?? ""} aria-label="频道">
          <option value="">全部频道</option>
          {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button type="submit" className="btn">筛选</button>
        <span className="hint">共 {total} 篇</span>
      </form>
      <table className="table">
        <thead>
          <tr><th>ID</th><th>标题</th><th>频道</th><th>状态</th><th>阅读</th><th>发布时间</th><th>操作</th></tr>
        </thead>
        <tbody>
          {items.map((a) => {
            const c = map.get(a.channelId);
            return (
              <tr key={a.id}>
                <td>{a.id}</td>
                <td>
                  <Link href={`/admin/articles/${a.id}`}>{a.title}</Link>
                  {a.isHeadline && <span className="badge red">头条</span>}
                  {a.isFocus && <span className="badge blue">焦点</span>}
                </td>
                <td>{c?.name ?? "-"}</td>
                <td>{a.status === "published" ? <span className="badge green">已发布</span> : <span className="badge">草稿</span>}</td>
                <td>{a.views}</td>
                <td>{formatDate(a.publishedAt)}</td>
                <td className="ops">
                  {c && a.status === "published" && <a href={articleUrl(a, c)} target="_blank" rel="noopener">查看</a>}
                  <Link href={`/admin/articles/${a.id}`}>编辑</Link>
                  <form action={deleteArticleAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <ConfirmButton message={`确定删除「${a.title}」？`} className="link danger">删除</ConfirmButton>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {totalPages > 1 && (
        <nav className="pagination" aria-label="分页">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) =>
            p === page ? <span key={p} className="current">{p}</span> : <Link key={p} href={qs(p)}>{p}</Link>,
          )}
        </nav>
      )}
    </>
  );
}
