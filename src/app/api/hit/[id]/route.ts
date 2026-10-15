import { incrementViews } from "@/lib/repo";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (Number.isInteger(id) && id > 0) await incrementViews(id);
  return new Response(null, { status: 204 });
}
