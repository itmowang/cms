import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getSettings, listChannels } from "@/lib/repo";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, channels] = await Promise.all([getSettings(), listChannels()]);
  return (
    <>
      <a href="#main" className="skip-link">跳到正文</a>
      <SiteHeader settings={settings} channels={channels} />
      <main id="main" className="wrap main">{children}</main>
      <SiteFooter settings={settings} channels={channels} />
    </>
  );
}
