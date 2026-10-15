import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getSettings, listChannels, topTags } from "@/lib/repo";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, channels, tags] = await Promise.all([getSettings(), listChannels(), topTags(10)]);
  return (
    <>
      <a href="#main" className="skip-link">跳到正文</a>
      <SiteHeader settings={settings} channels={channels} hotTags={tags.map((t) => t.tag)} />
      <main id="main" className="wrap main">{children}</main>
      <SiteFooter settings={settings} channels={channels} />
    </>
  );
}
