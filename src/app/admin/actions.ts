"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, getAdminCredentials, safeEqual, SESSION_COOKIE, SESSION_TTL, verifySession } from "@/lib/auth";
import * as svc from "@/lib/services";
import type { Article, FriendLink } from "@/lib/types";

/* ---------------- 工具 ---------------- */

async function requireAdmin() {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");
  return session;
}

const str = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);
const bool = (fd: FormData, k: string) => fd.get(k) === "on";
const int = (fd: FormData, k: string) => {
  const n = Number(fd.get(k));
  return Number.isInteger(n) ? n : 0;
};

function back(path: string, error: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}`);
}

/** 业务校验错误回显到表单；其他异常照常抛出 */
async function run<T>(path: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof svc.ValidationError) back(path, e.message);
    throw e;
  }
}

/* ---------------- 登录 ---------------- */

export async function loginAction(fd: FormData) {
  const user = str(fd, "user", 64);
  const password = str(fd, "password", 128);
  const nextRaw = str(fd, "next", 200);
  // 只允许跳回后台内部地址，防止开放重定向
  const next = /^\/admin(\/|$)/.test(nextRaw) ? nextRaw : "/admin";

  const cred = getAdminCredentials();
  if (!cred) back("/admin/login", "服务器未配置 ADMIN_USER / ADMIN_PASSWORD");
  const ok = (await safeEqual(user, cred.user)) && (await safeEqual(password, cred.password));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 600)); // 简单减缓暴力破解
    back("/admin/login", "用户名或密码错误");
  }

  (await cookies()).set(SESSION_COOKIE, await createSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL,
  });
  redirect(next);
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

/* ---------------- 文章 ---------------- */

export async function saveArticleAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, "id") || undefined;
  const formPath = id ? `/admin/articles/${id}` : "/admin/articles/new";

  // 表单是整篇提交，所有字段都显式传入（未勾选的复选框 = false）
  const { article } = await run(formPath, () =>
    svc.upsertArticle(id, {
      title: str(fd, "title", 120),
      shortTitle: str(fd, "shortTitle", 40),
      channelId: int(fd, "channelId"),
      summary: str(fd, "summary", 500),
      content: String(fd.get("content") ?? ""),
      cover: str(fd, "cover", 500),
      author: str(fd, "author", 50),
      source: str(fd, "source", 50),
      tags: str(fd, "tags", 200),
      isHeadline: bool(fd, "isHeadline"),
      isFocus: bool(fd, "isFocus"),
      status: fd.get("status") === "published" ? "published" : "draft",
      publishedAt: str(fd, "publishedAt", 30) || undefined,
    }),
  );
  redirect(`/admin/articles/${(article as Article).id}?ok=1`);
}

export async function deleteArticleAction(fd: FormData) {
  await requireAdmin();
  await run("/admin/articles", () => svc.removeArticle(int(fd, "id")));
  redirect("/admin/articles?ok=1");
}

/* ---------------- 频道 ---------------- */

export async function saveChannelAction(fd: FormData) {
  await requireAdmin();
  await run("/admin/channels", () =>
    svc.upsertChannel(int(fd, "id") || undefined, {
      slug: str(fd, "slug", 30),
      name: str(fd, "name", 20),
      description: str(fd, "description", 300),
      keywords: str(fd, "keywords", 200),
      sort: int(fd, "sort"),
      showInNav: bool(fd, "showInNav"),
    }),
  );
  redirect("/admin/channels?ok=1");
}

export async function deleteChannelAction(fd: FormData) {
  await requireAdmin();
  await run("/admin/channels", () => svc.removeChannel(int(fd, "id")));
  redirect("/admin/channels?ok=1");
}

/* ---------------- 站点设置 ---------------- */

export async function saveSettingsAction(fd: FormData) {
  await requireAdmin();
  const friendLinks: FriendLink[] = String(fd.get("friendLinks") ?? "")
    .split(/\r?\n/)
    .map((line) => line.split("|").map((s) => s.trim()))
    .filter(([n, u]) => n && u)
    .map(([name, url]) => ({ name, url }));

  await run("/admin/settings", () =>
    svc.patchSettings({
      name: str(fd, "name", 50),
      logoText: str(fd, "logoText", 20),
      slogan: str(fd, "slogan", 50),
      description: str(fd, "description", 300),
      keywords: str(fd, "keywords", 200),
      icp: str(fd, "icp", 50),
      copyright: str(fd, "copyright", 100),
      friendLinks,
    }),
  );
  redirect("/admin/settings?ok=1");
}
