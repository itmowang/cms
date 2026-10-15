import { ArticleForm } from "@/components/admin/ArticleForm";
import { Notice, sp, type AdminSearchParams } from "@/components/admin/Notice";
import { listChannels } from "@/lib/repo";

export default async function NewArticlePage({ searchParams }: { searchParams: AdminSearchParams }) {
  const q = await searchParams;
  return (
    <>
      <h1>发布文章</h1>
      <Notice error={sp(q.error)} />
      <ArticleForm channels={await listChannels()} />
    </>
  );
}
