import Link from "next/link";
import { stats } from "@/lib/repo";
import { SITE_URL } from "@/lib/urls";

export default async function Dashboard() {
  const s = await stats();
  const seoLinks = [
    ["sitemap.xml", "网站地图（提交给百度 / Google / Bing 站长平台）"],
    ["news-sitemap.xml", "新闻 Sitemap（48 小时内文章）"],
    ["robots.txt", "爬虫规则（已放行主流 AI 爬虫）"],
    ["rss.xml", "RSS 全文订阅"],
    ["llms.txt", "AI 站点导览（llmstxt.org 规范）"],
    ["llms-full.txt", "AI 全文合集"],
  ];
  return (
    <>
      <h1>控制台</h1>
      <div className="stat-grid">
        <div><strong>{s.articles}</strong><span>文章总数</span></div>
        <div><strong>{s.published}</strong><span>已发布</span></div>
        <div><strong>{s.drafts}</strong><span>草稿</span></div>
        <div><strong>{s.channels}</strong><span>频道</span></div>
        <div><strong>{s.views.toLocaleString()}</strong><span>总阅读量</span></div>
      </div>
      <p><Link href="/admin/articles/new" className="btn primary">+ 发布文章</Link></p>

      <h2>SEO / AI 抓取入口</h2>
      <table className="table">
        <tbody>
          {seoLinks.map(([path, desc]) => (
            <tr key={path}>
              <td><a href={`/${path}`} target="_blank" rel="noopener">{SITE_URL}/{path}</a></td>
              <td>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
