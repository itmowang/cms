import { saveArticleAction } from "@/app/admin/actions";
import type { Article, Channel } from "@/lib/types";
import { DIFFICULTIES, ingredientsToText } from "@/lib/recipe";
import { MarkdownEditor } from "./MarkdownEditor";

/** ISO -> datetime-local（北京时间） */
const toBjInput = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 16);

export function ArticleForm({ article, channels }: { article?: Article; channels: Channel[] }) {
  const a = article;
  const r = a?.recipe;
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
            摘要（一句话说清这道菜的特点，用于 description 和 AI 摘要，建议 50-120 字）
            <textarea name="summary" defaultValue={a?.summary} rows={3} maxLength={500} />
          </label>
          <fieldset className="recipe-fields">
            <legend>
              <label className="check">
                <input type="checkbox" name="hasRecipe" defaultChecked={a ? !!r : true} /> 这是一道菜谱（填写下方结构化信息，前台展示食材和步骤，并输出 Recipe 结构化数据）
              </label>
            </legend>
            <div className="row-4">
              <label>
                难度
                <select name="difficulty" defaultValue={r?.difficulty ?? "简单"}>
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label>
                准备时间（分钟）
                <input type="number" name="prepMinutes" min={0} max={6000} defaultValue={r?.prepMinutes ?? 10} />
              </label>
              <label>
                烹饪时间（分钟）
                <input type="number" name="cookMinutes" min={0} max={6000} defaultValue={r?.cookMinutes ?? 20} />
              </label>
              <label>
                份量
                <input name="servings" defaultValue={r?.servings ?? "2人份"} maxLength={20} />
              </label>
            </div>
            <label>
              口味（可选，如：酸甜、麻辣、咸鲜）
              <input name="flavor" defaultValue={r?.flavor} maxLength={20} />
            </label>
            <label>
              食材清单（每行一种，格式：食材|用量，例如 鸡蛋|3个）
              <textarea name="ingredients" rows={8} defaultValue={ingredientsToText(r?.ingredients)} placeholder={"番茄|2个\n鸡蛋|3个\n盐|适量"} />
            </label>
            <label>
              做法步骤（每行一步，开头的编号会自动去掉）
              <textarea name="steps" rows={10} defaultValue={r?.steps.join("\n")} placeholder={"番茄切块，鸡蛋打散。\n热锅倒油，炒鸡蛋盛出。\n..."} />
            </label>
            <label>
              小贴士（可选）
              <textarea name="tips" rows={2} defaultValue={r?.tips} maxLength={1000} />
            </label>
          </fieldset>

          <div className="label">正文（菜品介绍、故事、搭配建议等，Markdown）</div>
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
            <input name="author" defaultValue={a?.author ?? "粉厨小编"} maxLength={50} />
          </label>
          <label>
            来源
            <input name="source" defaultValue={a?.source ?? "本站"} maxLength={50} />
          </label>
          <label className="check">
            <input type="checkbox" name="isHeadline" defaultChecked={a?.isHeadline} /> 首页「今日推荐」
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
