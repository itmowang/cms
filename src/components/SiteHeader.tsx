import Link from "next/link";
import type { Channel, SiteSettings } from "@/lib/types";
import { channelUrl } from "@/lib/urls";
import { formatDate } from "@/lib/markdown";
import { ChannelNav } from "./ChannelNav";

export function SiteHeader({ settings, channels }: { settings: SiteSettings; channels: Channel[] }) {
  const today = formatDate(new Date().toISOString(), false);
  return (
    <header className="site-header">
      <div className="topbar">
        <div className="wrap topbar-inner">
          <span>{settings.name} · {today}</span>
          <nav aria-label="快捷链接" className="topbar-links">
            <Link href="/rss.xml" prefetch={false}>RSS订阅</Link>
            <Link href="/sitemap.xml" prefetch={false}>网站地图</Link>
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
        <form action="/search" method="get" className="search" role="search">
          <label htmlFor="site-search" className="sr-only">站内搜索</label>
          <input id="site-search" name="q" type="search" placeholder="搜菜谱、食材，如：鸡蛋" maxLength={50} />
          <button type="submit">搜索</button>
        </form>
      </div>
      <nav className="channel-nav" aria-label="频道导航">
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
