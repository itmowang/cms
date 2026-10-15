import { formatMinutes, totalMinutes } from "@/lib/recipe";
import type { Ingredient, RecipeInfo } from "@/lib/types";

/** 每行放两种食材，表格样式（门户常见的参数表排版） */
function pairs(list: Ingredient[]): Array<[Ingredient, Ingredient | undefined]> {
  const rows: Array<[Ingredient, Ingredient | undefined]> = [];
  for (let i = 0; i < list.length; i += 2) rows.push([list[i], list[i + 1]]);
  return rows;
}

/** 菜谱主体：参数表、食材表、分步做法、小贴士（全部服务端渲染，爬虫可直接读取） */
export function RecipeView({ recipe: r }: { recipe: RecipeInfo }) {
  return (
    <>
      <table className="recipe-table">
        <caption className="sr-only">菜谱信息</caption>
        <tbody>
          <tr>
            <th scope="row">难度</th>
            <td>{r.difficulty}</td>
            <th scope="row">口味</th>
            <td>{r.flavor ?? "—"}</td>
            <th scope="row">份量</th>
            <td>{r.servings}</td>
          </tr>
          <tr>
            <th scope="row">准备</th>
            <td>{formatMinutes(r.prepMinutes)}</td>
            <th scope="row">烹饪</th>
            <td>{formatMinutes(r.cookMinutes)}</td>
            <th scope="row">总耗时</th>
            <td>{formatMinutes(totalMinutes(r))}</td>
          </tr>
        </tbody>
      </table>

      <section className="recipe-section" aria-labelledby="ing-title">
        <h2 id="ing-title" className="sec-title">
          食材清单<small>共 {r.ingredients.length} 种</small>
        </h2>
        <table className="ing-table">
          <thead>
            <tr>
              <th scope="col">食材</th>
              <th scope="col">用量</th>
              <th scope="col">食材</th>
              <th scope="col">用量</th>
            </tr>
          </thead>
          <tbody>
            {pairs(r.ingredients).map(([a, b], idx) => (
              <tr key={idx}>
                <td>{a.name}</td>
                <td className="amt">{a.amount}</td>
                <td>{b?.name ?? ""}</td>
                <td className="amt">{b?.amount ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="recipe-section" aria-labelledby="steps-title">
        <h2 id="steps-title" className="sec-title">
          做法步骤<small>共 {r.steps.length} 步</small>
        </h2>
        <ol className="steps">
          {r.steps.map((s, idx) => (
            <li key={idx} id={`step-${idx + 1}`}>
              <strong className="step-no">步骤{idx + 1}</strong>
              <p>{s}</p>
            </li>
          ))}
        </ol>
      </section>

      {r.tips && (
        <section className="recipe-tips" aria-label="小贴士">
          <strong>小贴士：</strong>
          {r.tips}
        </section>
      )}
    </>
  );
}
