import { notFound } from "next/navigation";
import { ArticleForm } from "@/components/admin/ArticleForm";
import { Notice, sp, type AdminSearchParams } from "@/components/admin/Notice";
import { adminGetArticle, getChannelById, listChannels } from "@/lib/repo";
import { articleMdUrl, articleUrl } from "@/lib/urls";

type Props = { params: Promise<{ id: string }>; searchParams: AdminSearchParams };

export default async function EditArticlePage({ params, searchParams }: Props) {
  const [{ id }, q] = await Promise.all([params, searchParams]);
  const article = await adminGetArticle(Number(id));
  if (!article) notFound();
  const [channels, channel] = await Promise.all([listChannels(), getChannelById(article.channelId)]);

  return (
    <>
      <h1>
        编辑文章 #{article.id}
        {channel && article.status === "published" && (
          <small>
            <a href={articleUrl(article, channel)} target="_blank" rel="noopener">{articleUrl(article, channel)}</a>
            {" · "}
            <a href={articleMdUrl(article, channel)} target="_blank" rel="noopener">Markdown 版</a>
          </small>
        )}
      </h1>
      <Notice error={sp(q.error)} ok={sp(q.ok)} />
      <ArticleForm article={article} channels={channels} />
    </>
  );
}
