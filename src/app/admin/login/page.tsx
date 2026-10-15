import type { Metadata } from "next";
import { loginAction } from "../actions";
import { Notice, sp, type AdminSearchParams } from "@/components/admin/Notice";

export const metadata: Metadata = { title: "登录" };

export default async function LoginPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const q = await searchParams;
  return (
    <main className="login">
      <form action={loginAction} className="login-box">
        <h1>CMS 管理后台</h1>
        <Notice error={sp(q.error)} />
        <input type="hidden" name="next" value={sp(q.next) ?? "/admin"} />
        <label>
          用户名
          <input name="user" autoComplete="username" required maxLength={64} />
        </label>
        <label>
          密码
          <input name="password" type="password" autoComplete="current-password" required maxLength={128} />
        </label>
        <button type="submit" className="btn primary">登 录</button>
        {process.env.NODE_ENV !== "production" && !process.env.ADMIN_PASSWORD && (
          <p className="hint">开发环境默认账号：admin / admin123（在 .env.local 中配置 ADMIN_USER / ADMIN_PASSWORD）</p>
        )}
      </form>
    </main>
  );
}
