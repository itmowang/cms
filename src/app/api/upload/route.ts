import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { absUrl } from "@/lib/urls";
import { MAX_UPLOAD_BYTES, saveImage, UploadError } from "@/lib/uploads";

/**
 * 后台图片上传：POST /api/upload（multipart/form-data，字段 file）
 * 鉴权：后台登录 Cookie；并校验 Origin，防止跨站伪造请求。
 * 返回：{ url, path, width, height, bytes, type }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const err = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return err(401, "未登录或登录已过期");

  // 只接受同源请求（SameSite=lax 之外再加一道 CSRF 防护）
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return err(403, "来源校验失败");

  const length = Number(req.headers.get("content-length") || 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) return err(413, "图片不能超过 10MB");

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return err(400, "请求格式不正确");
  }
  if (!(file instanceof File)) return err(400, "缺少文件");

  try {
    const saved = await saveImage(Buffer.from(await file.arrayBuffer()));
    return Response.json({ url: absUrl(saved.path), ...saved });
  } catch (e) {
    if (e instanceof UploadError) return err(400, e.message);
    console.error("[upload]", e);
    return err(500, "上传失败，请稍后再试");
  }
}
