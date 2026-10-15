import { deleteChannelAction, saveChannelAction } from "../../actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Notice, sp, type AdminSearchParams } from "@/components/admin/Notice";
import { listChannels } from "@/lib/repo";
import type { Channel } from "@/lib/types";

function ChannelRow({ c }: { c?: Channel }) {
  const formId = `ch-${c?.id ?? "new"}`;
  return (
    <tr>
      <td>
        <form id={formId} action={saveChannelAction} />
        {c ? c.id : "新增"}
        {c && <input form={formId} type="hidden" name="id" value={c.id} />}
      </td>
      <td><input form={formId} name="name" defaultValue={c?.name} required maxLength={20} aria-label="名称" /></td>
      <td><input form={formId} name="slug" defaultValue={c?.slug} required pattern="[a-z][a-z0-9\-]{1,29}" aria-label="目录名" /></td>
      <td><input form={formId} name="description" defaultValue={c?.description} maxLength={300} aria-label="描述" /></td>
      <td><input form={formId} name="keywords" defaultValue={c?.keywords} maxLength={200} aria-label="关键词" /></td>
      <td><input form={formId} name="sort" type="number" defaultValue={c?.sort ?? 99} className="narrow" aria-label="排序" /></td>
      <td><input form={formId} name="showInNav" type="checkbox" defaultChecked={c?.showInNav ?? true} aria-label="导航显示" /></td>
      <td className="ops">
        <button form={formId} type="submit" className="btn small primary">{c ? "保存" : "添加"}</button>
        {c && (
          <form action={deleteChannelAction}>
            <input type="hidden" name="id" value={c.id} />
            <ConfirmButton message={`确定删除频道「${c.name}」？`} className="link danger">删除</ConfirmButton>
          </form>
        )}
      </td>
    </tr>
  );
}

export default async function ChannelsPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const q = await searchParams;
  const channels = await listChannels();
  return (
    <>
      <h1>频道管理</h1>
      <p className="hint">目录名即伪静态 URL 目录，例如 news → /news、/news/123.html。修改目录名后，旧文章链接会 404，请谨慎操作。</p>
      <Notice error={sp(q.error)} ok={sp(q.ok)} />
      <table className="table">
        <thead>
          <tr><th>ID</th><th>名称</th><th>目录名</th><th>描述（SEO）</th><th>关键词（SEO）</th><th>排序</th><th>导航</th><th>操作</th></tr>
        </thead>
        <tbody>
          {channels.map((c) => <ChannelRow key={c.id} c={c} />)}
          <ChannelRow />
        </tbody>
      </table>
    </>
  );
}
