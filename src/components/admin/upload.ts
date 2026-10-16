/** 后台浏览器端上传图片到 /api/upload，返回站内路径 */
export const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp,image/gif,image/avif";
const MAX_BYTES = 10 * 1024 * 1024;

export interface UploadResult {
  url: string;
  path: string;
  width: number;
  height: number;
  bytes: number;
}

export async function uploadImage(file: File): Promise<UploadResult> {
  if (!file.type.startsWith("image/")) throw new Error(`「${file.name}」不是图片`);
  if (file.size > MAX_BYTES) throw new Error(`「${file.name}」超过 10MB`);
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "same-origin" });
  const data = (await res.json().catch(() => ({}))) as Partial<UploadResult> & { error?: string };
  if (!res.ok || !data.path) {
    if (res.status === 401) throw new Error("登录已过期，请刷新页面重新登录（当前内容请先复制保存）");
    throw new Error(data.error || `上传失败（HTTP ${res.status}）`);
  }
  return data as UploadResult;
}

/** 文件名去掉扩展名作为图片说明（alt） */
export const altFromName = (name: string) =>
  name.replace(/\.[a-z0-9]+$/i, "").replace(/[[\]()]/g, "").slice(0, 60) || "图片";

export const formatBytes = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.round(n / 1024)}KB`);
