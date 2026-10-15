import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap not-found">
      <h1>404 · 页面不存在</h1>
      <p>您访问的页面可能已被删除、更名或暂时不可用。</p>
      <p><Link href="/">返回首页</Link></p>
    </main>
  );
}
