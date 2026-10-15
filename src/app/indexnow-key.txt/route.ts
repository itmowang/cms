export const dynamic = "force-dynamic";

/** IndexNow 密钥验证文件 */
export function GET() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return new Response("Not Found", { status: 404 });
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
