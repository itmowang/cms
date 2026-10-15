/**
 * 后台会话：HMAC-SHA256 签名 Cookie，基于 Web Crypto，proxy 与服务端通用。
 */
export const SESSION_COOKIE = "cms_session";
export const SESSION_TTL = 60 * 60 * 8; // 8 小时

const isProd = process.env.NODE_ENV === "production";
const enc = new TextEncoder();

function getSecret(): string | null {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  return isProd ? null : "dev-only-insecure-secret-do-not-use-in-production!!";
}

export function getAdminCredentials(): { user: string; password: string } | null {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;
  if (user && password) return { user, password };
  // 开发环境给默认账号，生产环境未配置则禁止登录
  return isProd ? null : { user: "admin", password: "admin123" };
}

const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
};

async function key(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSession(user: string): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error("AUTH_SECRET 未配置或长度不足 32 位");
  const payload = b64url(enc.encode(JSON.stringify({ u: user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL })));
  const sig = await crypto.subtle.sign("HMAC", await key(secret), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

export async function verifySession(token: string | undefined): Promise<{ user: string } | null> {
  const secret = getSecret();
  if (!token || !secret) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(secret), fromB64url(sig), enc.encode(payload));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { u: string; exp: number };
    if (data.exp < Date.now() / 1000) return null;
    return { user: data.u };
  } catch {
    return null;
  }
}

/** 常量时间比较，防止计时攻击 */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const k = await key("compare");
  const [x, y] = await Promise.all([
    crypto.subtle.sign("HMAC", k, enc.encode(a)),
    crypto.subtle.sign("HMAC", k, enc.encode(b)),
  ]);
  const xa = new Uint8Array(x);
  const ya = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ ya[i];
  return diff === 0;
}
