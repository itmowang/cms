import "server-only";
import { SITE_URL } from "./urls";

/**
 * 发布后主动推送给搜索引擎，加快收录。只有配置了环境变量才会发请求。
 * - 百度普通收录 API：BAIDU_PUSH_API
 * - IndexNow（Bing / Yandex / Seznam 等）：INDEXNOW_KEY
 */
export async function pushUrls(urls: string[]): Promise<string[]> {
  const logs: string[] = [];
  if (!urls.length) return logs;

  const baidu = process.env.BAIDU_PUSH_API;
  if (baidu) {
    try {
      const res = await fetch(baidu, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: urls.join("\n"),
        signal: AbortSignal.timeout(5000),
      });
      logs.push(`百度推送：${res.status} ${await res.text()}`);
    } catch (e) {
      logs.push(`百度推送失败：${(e as Error).message}`);
    }
  }

  const key = process.env.INDEXNOW_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: new URL(SITE_URL).host,
          key,
          keyLocation: `${SITE_URL}/indexnow-key.txt`,
          urlList: urls,
        }),
        signal: AbortSignal.timeout(5000),
      });
      logs.push(`IndexNow：${res.status}`);
    } catch (e) {
      logs.push(`IndexNow 失败：${(e as Error).message}`);
    }
  }
  return logs;
}
