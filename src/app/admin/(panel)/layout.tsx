import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { logoutAction } from "../actions";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // proxy 已拦截，这里再校验一次（纵深防御）
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-brand">CMS 后台</div>
        <nav aria-label="后台菜单">
          <Link href="/admin">控制台</Link>
          <Link href="/admin/articles">文章管理</Link>
          <Link href="/admin/articles/new">发布文章</Link>
          <Link href="/admin/channels">频道管理</Link>
          <Link href="/admin/settings">站点设置</Link>
          <a href="/" target="_blank" rel="noopener">查看前台 ↗</a>
        </nav>
        <form action={logoutAction} className="admin-user">
          <span>{session.user}</span>
          <button type="submit" className="btn small">退出</button>
        </form>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
