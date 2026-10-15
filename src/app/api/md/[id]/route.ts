import { articleToMarkdown } from "@/lib/feed";
import { getChannelById, getPublishedArticle, getSettings } from "@/lib/repo";
import { absUrl, articleUrl } from "@/lib/urls";

export const revalidate = 300;

/** 对外地址：/频道/ID.md（next.config.ts 中的 rewrite） */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const a = Number.isInteger(id) ? await getPublishedArticle(id) : undefined;
  const c = a && (await getChannelById(a.channelId));
  if (!a || !c) return new Response("Not Found", { status: 404 });
  const s = await getSettings();
  return new Response(articleToMarkdown(a, c, s.name), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
      // 告诉搜索引擎规范页是 HTML 版本，避免重复收录
      Link: `<${absUrl(articleUrl(a, c))}>; rel="canonical"`,
      "X-Robots-Tag": "noindex",
    },
  });
}
