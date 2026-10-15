import Link from "next/link";
import type { Channel, SiteSettings } from "@/lib/types";
import { channelUrl, tagUrl } from "@/lib/urls";
import { formatDate } from "@/lib/markdown";
import { ChannelNav } from "./ChannelNav";

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

export function SiteHeader({ settings, channels, hotTags }: { settings: SiteSettings; channels: Channel[]; hotTags: string[] }) {
  const now = new Date();
  const today = `${formatDate(now.toISOString(), false)} 星期${WEEK[new Date(now.getTime() + 8 * 3600_000).getUTCDay()]}`;
  return (
    <header className="site-header">
      <div className="topbar">
        <div className="wrap topbar-inner">
          <span>欢迎访问{settings.name}！今天是 {today}</span>
          <nav aria-label="快捷链接" className="topbar-links">
            <Link href="/rss.xml" prefetch={false}>RSS订阅</Link>
            <span aria-hidden="true">|</span>
            <Link href="/sitemap.xml" prefetch={false}>网站地图</Link>
            <span aria-hidden="true">|</span>
            <a href="/llms.txt">AI 索引</a>
          </nav>
        </div>
      </div>

      <div className="wrap brand">
        <Link href="/" className="logo" aria-label={`${settings.name}首页`}>
          <span className="logo-mark">{settings.logoText.slice(0, 2)}</span>
          <span className="logo-text">
            <strong>{settings.logoText}</strong>
            <small>{settings.slogan}</small>
          </span>
        </Link>
        <div className="search-area">
          <form action="/search" method="get" className="search" role="search">
            <label htmlFor="site-search" className="sr-only">搜索菜谱或食材</label>
            <input id="site-search" name="q" type="search" placeholder="输入菜名或食材，如：红烧肉、鸡蛋" maxLength={50} />
            <button type="submit">搜 索</button>
          </form>
          {hotTags.length > 0 && (
            <p className="hot-words">
              热门搜索：
              {hotTags.slice(0, 8).map((t) => (
                <Link key={t} href={tagUrl(t)}>{t}</Link>
              ))}
            </p>
          )}
        </div>
      </div>

      <nav className="channel-nav" aria-label="菜谱分类导航">
        <div className="wrap">
          <ChannelNav
            items={[
              { href: "/", name: "首页", slug: "" },
              ...channels.filter((c) => c.showInNav).map((c) => ({ href: channelUrl(c), name: c.name, slug: c.slug })),
            ]}
          />
        </div>
      </nav>
    </header>
  );
}
