"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ChannelNav({ items }: { items: Array<{ href: string; name: string; slug: string }> }) {
  const pathname = usePathname();
  const seg = pathname.split("/")[1] ?? "";
  return (
    <ul>
      {items.map((it) => {
        const active = it.slug === seg;
        return (
          <li key={it.href} className={active ? "active" : undefined}>
            <Link href={it.href} aria-current={active ? "page" : undefined}>{it.name}</Link>
          </li>
        );
      })}
    </ul>
  );
}
