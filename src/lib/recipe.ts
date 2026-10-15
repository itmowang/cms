import type { Difficulty, Ingredient, RecipeInfo } from "./types";

export const DIFFICULTIES: Difficulty[] = ["简单", "中等", "较难"];

/** 分钟 -> "1小时10分钟" */
export function formatMinutes(min: number): string {
  if (!min) return "无需";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h}小时` : "", m ? `${m}分钟` : ""].join("") || "0分钟";
}

/** 分钟 -> ISO 8601 时长（schema.org Recipe 用），如 PT1H10M */
export function isoDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `PT${h ? `${h}H` : ""}${m || !h ? `${m}M` : ""}`;
}

export const totalMinutes = (r: RecipeInfo) => r.prepMinutes + r.cookMinutes;

/** 后台文本框格式：每行 "食材|用量" */
export const ingredientsToText = (list: Ingredient[] = []) => list.map((i) => `${i.name}|${i.amount}`).join("\n");

export function textToIngredients(text: string): Ingredient[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split(/[|｜]/);
      return { name: name.trim(), amount: rest.join("|").trim() || "适量" };
    })
    .filter((i) => i.name);
}

/** 后台文本框格式：每行一步，自动去掉开头的 "1." "1、" "第1步" 等编号 */
export const textToSteps = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(第\s*\d+\s*步[:：、.]?|\d+\s*[.、:：)）])\s*/, ""))
    .filter(Boolean);

/** 菜谱转 Markdown 片段（.md、llms-full.txt、RSS 使用） */
export function recipeToMarkdown(r: RecipeInfo): string {
  const meta = [
    `- 难度：${r.difficulty}`,
    `- 准备时间：${formatMinutes(r.prepMinutes)}`,
    `- 烹饪时间：${formatMinutes(r.cookMinutes)}`,
    `- 份量：${r.servings}`,
    r.flavor ? `- 口味：${r.flavor}` : "",
  ].filter(Boolean);
  const ing = r.ingredients.map((i) => `| ${i.name} | ${i.amount} |`);
  const steps = r.steps.map((s, i) => `${i + 1}. ${s}`);
  return [
    "## 菜谱信息",
    "",
    ...meta,
    "",
    "## 食材清单",
    "",
    "| 食材 | 用量 |",
    "| --- | --- |",
    ...ing,
    "",
    "## 做法步骤",
    "",
    ...steps,
    ...(r.tips ? ["", "## 小贴士", "", r.tips] : []),
  ].join("\n");
}
