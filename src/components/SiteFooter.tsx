import Link from "next/link";
import type { Channel, SiteSettings } from "@/lib/types";
import { channelUrl } from "@/lib/urls";

export function SiteFooter({ settings, channels }: { settings: SiteSettings; channels: Channel[] }) {
  return (
    <footer className="site-footer">
      {settings.friendLinks.length > 0 && (
        <div className="wrap friend-links">
          <span>友情链接：</span>
          {settings.friendLinks.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener">{l.name}</a>
          ))}
        </div>
      )}
      <div className="wrap footer-nav">
        {channels.map((c) => (
          <Link key={c.id} href={channelUrl(c)}>{c.name}</Link>
        ))}
        <Link href="/sitemap.xml" prefetch={false}>网站地图</Link>
        <Link href="/rss.xml" prefetch={false}>RSS</Link>
      </div>
      <div className="wrap footer-copy">
        <p>© {new Date().getFullYear()} {settings.copyright}</p>
        {settings.icp && (
          <p>
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener nofollow">{settings.icp}</a>
          </p>
        )}
      </div>
    </footer>
  );
}
