"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export interface Slide {
  href: string;
  title: string;
  cover?: string;
  channel: string;
}

const gradients = [
  "linear-gradient(135deg,#b91c1c,#7f1d1d)",
  "linear-gradient(135deg,#1d4ed8,#1e3a8a)",
  "linear-gradient(135deg,#047857,#064e3b)",
  "linear-gradient(135deg,#b45309,#78350f)",
  "linear-gradient(135deg,#6d28d9,#4c1d95)",
];

/**
 * 焦点图轮播。所有幻灯片都在服务端 HTML 中完整输出（只是视觉上隐藏），
 * 因此爬虫无需执行 JS 就能拿到全部链接和标题。
 */
export function FocusSlider({ slides }: { slides: Slide[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [paused, slides.length]);

  if (!slides.length) return null;

  return (
    <section
      className="focus"
      aria-roledescription="carousel"
      aria-label="焦点图"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {slides.map((s, i) => (
        <Link
          key={s.href}
          href={s.href}
          className={`focus-item${i === idx ? " active" : ""}`}
          aria-hidden={i !== idx}
          tabIndex={i === idx ? 0 : -1}
          style={s.cover ? undefined : { background: gradients[i % gradients.length] }}
        >
          {s.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.cover} alt={s.title} loading={i === 0 ? "eager" : "lazy"} />
          ) : (
            <span className="focus-placeholder" aria-hidden="true">{s.channel}</span>
          )}
          <span className="focus-caption">{s.title}</span>
        </Link>
      ))}
      <div className="focus-dots" role="tablist" aria-label="切换焦点图">
        {slides.map((s, i) => (
          <button
            key={s.href}
            type="button"
            role="tab"
            aria-selected={i === idx}
            aria-label={`第 ${i + 1} 张：${s.title}`}
            onClick={() => setIdx(i)}
            className={i === idx ? "on" : undefined}
          />
        ))}
      </div>
    </section>
  );
}
