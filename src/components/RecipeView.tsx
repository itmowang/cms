import { formatMinutes, totalMinutes } from "@/lib/recipe";
import type { RecipeInfo } from "@/lib/types";

/** 菜谱主体：信息卡、食材清单、分步做法、小贴士（全部服务端渲染，爬虫可直接读取） */
export function RecipeView({ recipe: r }: { recipe: RecipeInfo }) {
  const facts: Array<[string, string]> = [
    ["难度", r.difficulty],
    ["准备", formatMinutes(r.prepMinutes)],
    ["烹饪", formatMinutes(r.cookMinutes)],
    ["总耗时", formatMinutes(totalMinutes(r))],
    ["份量", r.servings],
    ...(r.flavor ? ([["口味", r.flavor]] as Array<[string, string]>) : []),
  ];

  return (
    <>
      <dl className="recipe-facts">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <section className="recipe-section" aria-labelledby="ing-title">
        <h2 id="ing-title">🥕 食材清单 <small>（{r.ingredients.length} 种，可勾选备料）</small></h2>
        <ul className="ingredients">
          {r.ingredients.map((i, idx) => (
            <li key={`${i.name}-${idx}`}>
              <label>
                <input type="checkbox" />
                <span className="ing-name">{i.name}</span>
                <span className="ing-amount">{i.amount}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="recipe-section" aria-labelledby="steps-title">
        <h2 id="steps-title">👩‍🍳 做法步骤 <small>（共 {r.steps.length} 步）</small></h2>
        <ol className="steps">
          {r.steps.map((s, idx) => (
            <li key={idx} id={`step-${idx + 1}`}>
              <span className="step-no" aria-hidden="true">{idx + 1}</span>
              <p>{s}</p>
            </li>
          ))}
        </ol>
      </section>

      {r.tips && (
        <aside className="recipe-tips" aria-label="小贴士">
          <strong>💡 小贴士</strong>
          <p>{r.tips}</p>
        </aside>
      )}
    </>
  );
}
