import { Marked } from "marked";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const isSafeUrl = (href: string) => /^(https?:|mailto:|\/|#)/i.test(href.trim());

/**
 * 正文 Markdown 渲染：
 * - 禁止原始 HTML（转义输出），防止 XSS
 * - 只允许 http/https/站内链接
 * - 外链加 rel="nofollow noopener"
 * - 图片默认懒加载
 */
const md = new Marked({
  gfm: true,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      if (!isSafeUrl(href)) return text;
      const external = /^https?:/i.test(href);
      const t = title ? ` title="${escapeHtml(title)}"` : "";
      const rel = external ? ` target="_blank" rel="nofollow noopener"` : "";
      return `<a href="${escapeHtml(href)}"${t}${rel}>${text}</a>`;
    },
    image({ href, title, text }) {
      if (!isSafeUrl(href)) return "";
      const t = title ? ` title="${escapeHtml(title)}"` : "";
      return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${t} loading="lazy" decoding="async">`;
    },
  },
});

export function renderMarkdown(src: string): string {
  return md.parse(src, { async: false }) as string;
}

/** 去掉 Markdown 标记，得到纯文本（用于 description 兜底、字数统计） */
export function markdownToText(src: string): string {
  return src
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/^[#>\-*+\s\d.]+/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const formatDate = (iso: string, withTime = true) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  // 固定使用北京时间，避免服务器时区不同导致前后台显示不一致
  const bj = new Date(d.getTime() + (8 * 60 + d.getTimezoneOffset()) * 60000);
  const date = `${bj.getFullYear()}-${p(bj.getMonth() + 1)}-${p(bj.getDate())}`;
  return withTime ? `${date} ${p(bj.getHours())}:${p(bj.getMinutes())}` : date;
};

export const formatMd = (iso: string) => formatDate(iso, false).slice(5);
