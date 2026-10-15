import { saveSettingsAction } from "../../actions";
import { Notice, sp, type AdminSearchParams } from "@/components/admin/Notice";
import { getSettings } from "@/lib/repo";

export default async function SettingsPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const [q, s] = await Promise.all([searchParams, getSettings()]);
  return (
    <>
      <h1>站点设置</h1>
      <Notice error={sp(q.error)} ok={sp(q.ok)} />
      <form action={saveSettingsAction} className="form narrow-form">
        <label>站点名称<input name="name" defaultValue={s.name} required maxLength={50} /></label>
        <label>Logo 文字<input name="logoText" defaultValue={s.logoText} maxLength={20} /></label>
        <label>口号（首页 title 后缀）<input name="slogan" defaultValue={s.slogan} maxLength={50} /></label>
        <label>站点描述（description）<textarea name="description" defaultValue={s.description} rows={3} maxLength={300} /></label>
        <label>站点关键词（keywords）<input name="keywords" defaultValue={s.keywords} maxLength={200} /></label>
        <label>ICP 备案号<input name="icp" defaultValue={s.icp} maxLength={50} /></label>
        <label>版权信息<input name="copyright" defaultValue={s.copyright} maxLength={100} /></label>
        <label>
          友情链接（每行一个：名称|https://网址）
          <textarea name="friendLinks" rows={5} defaultValue={s.friendLinks.map((l) => `${l.name}|${l.url}`).join("\n")} />
        </label>
        <button type="submit" className="btn primary">保 存</button>
      </form>
    </>
  );
}
