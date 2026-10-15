import { saveArticleAction } from "@/app/admin/actions";
import type { Article, Channel } from "@/lib/types";
import { MarkdownEditor } from "./MarkdownEditor";

/** ISO -> datetime-local（北京时间） */
const toBjInput = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 16);

export function ArticleForm({ article, channels }: { article?: Article; channels: Channel[] }) {
  const a = article;
  return (
    <form action={saveArticleAction} className="form">
      {a && <input type="hidden" name="id" value={a.id} />}
      <div className="form-grid">
        <div className="form-main">
          <label>
            标题 *
            <input name="title" defaultValue={a?.title} required maxLength={120} />
          </label>
          <label>
            短标题（首页列表显示，可选）
            <input name="shortTitle" defaultValue={a?.shortTitle} maxLength={40} />
          </label>
          <label>
            摘要（用于 description、AI 摘要，建议 80-150 字）
            <textarea name="summary" defaultValue={a?.summary} rows={3} maxLength={500} />
          </label>
          <div className="label">正文</div>
          <MarkdownEditor name="content" defaultValue={a?.content ?? ""} />
        </div>

        <div className="form-side">
          <label>
            频道 *
            <select name="channelId" defaultValue={a?.channelId ?? channels[0]?.id} required>
              {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            状态
            <select name="status" defaultValue={a?.status ?? "published"}>
              <option value="published">发布</option>
              <option value="draft">草稿</option>
            </select>
          </label>
          <label>
            发布时间（北京时间，可设未来时间定时发布）
            <input type="datetime-local" name="publishedAt" defaultValue={toBjInput(a?.publishedAt ?? new Date().toISOString())} />
          </label>
          <label>
            标签（逗号或空格分隔）
            <input name="tags" defaultValue={a?.tags.join(",")} maxLength={200} />
          </label>
          <label>
            封面图 URL
            <input name="cover" defaultValue={a?.cover} placeholder="https://... 或 /uploads/..." maxLength={500} />
          </label>
          <label>
            作者
            <input name="author" defaultValue={a?.author ?? "本网编辑"} maxLength={50} />
          </label>
          <label>
            来源
            <input name="source" defaultValue={a?.source ?? "本站"} maxLength={50} />
          </label>
          <label className="check">
            <input type="checkbox" name="isHeadline" defaultChecked={a?.isHeadline} /> 首页头条
          </label>
          <label className="check">
            <input type="checkbox" name="isFocus" defaultChecked={a?.isFocus} /> 焦点图
          </label>
          <button type="submit" className="btn primary block">保 存</button>
        </div>
      </div>
    </form>
  );
}
