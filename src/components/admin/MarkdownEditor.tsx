"use client";

import { useMemo, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";

export function MarkdownEditor({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const html = useMemo(() => (tab === "preview" ? renderMarkdown(value) : ""), [tab, value]);

  return (
    <div className="md-editor">
      <div className="md-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "edit"} onClick={() => setTab("edit")}>编辑</button>
        <button type="button" role="tab" aria-selected={tab === "preview"} onClick={() => setTab("preview")}>预览</button>
        <span className="hint">支持 Markdown：## 小标题、**加粗**、[链接](url)、![图片](url)、&gt; 引用</span>
      </div>
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={22}
        hidden={tab !== "edit"}
      />
      {tab === "preview" && <div className="article-body md-preview" dangerouslySetInnerHTML={{ __html: html }} />}
    </div>
  );
}
