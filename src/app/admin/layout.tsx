import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "管理后台", template: "%s - 管理后台" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin">{children}</div>;
}
