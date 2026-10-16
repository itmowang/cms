import { readUpload } from "@/lib/uploads";

/**
 * 上传图片的访问地址 /uploads/YYYY/MM/<hash>.<ext>
 * 生产环境由 Caddy 直接读取文件返回（不经过 Node），这里是开发环境 / 无反向代理时的兜底。
 * 文件名是内容哈希，内容永不变化，可长期缓存。
 */
export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const file = await readUpload((await ctx.params).path);
  if (!file) return new Response("Not Found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(file.data.length),
    },
  });
}
