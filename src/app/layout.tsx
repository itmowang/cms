import type { Metadata, Viewport } from "next";
import { getSettings } from "@/lib/repo";
import { SITE_URL } from "@/lib/urls";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${s.name} - ${s.slogan}`, template: `%s_${s.name}` },
    description: s.description,
    keywords: s.keywords,
    applicationName: s.name,
    formatDetection: { telephone: false },
    alternates: {
      types: { "application/rss+xml": [{ url: "/rss.xml", title: `${s.name} RSS` }] },
    },
    other: {
      // 百度移动适配声明：本站为响应式
      "applicable-device": "pc,mobile",
      "Cache-Control": "no-transform",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e75480",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
