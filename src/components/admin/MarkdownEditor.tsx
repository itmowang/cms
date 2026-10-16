"use client";

import { useMemo, useRef, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { ACCEPT_IMAGES, altFromName, uploadImage } from "./upload";

let seq = 0;

export function MarkdownEditor({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const html = useMemo(() => (tab === "preview" ? renderMarkdown(value) : ""), [tab, value]);

  /** 在光标处插入占位符，上传完成后替换为图片 Markdown；失败则移除占位符 */
  async function insertImages(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    setError("");
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const placeholders = images.map((f) => `![上传中 ${altFromName(f.name)}…#${++seq}]()`);
    const before = value.slice(0, start);
    const lead = before && !before.endsWith("\n") ? "\n" : "";
    const block = `${lead}${placeholders.join("\n")}\n`;
    setValue(before + block + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + block.length, start + block.length);
    });

    setUploading((n) => n + images.length);
    await Promise.all(
      images.map(async (file, i) => {
        try {
          const r = await uploadImage(file);
          setValue((v) => v.replace(placeholders[i], `![${altFromName(file.name)}](${r.path})`));
        } catch (e) {
          setValue((v) => v.replace(`${placeholders[i]}\n`, "").replace(placeholders[i], ""));
          setError((e as Error).message);
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
  }

  return (
    <div className="md-editor">
      <div className="md-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "edit"} onClick={() => setTab("edit")}>编辑</button>
        <button type="button" role="tab" aria-selected={tab === "preview"} onClick={() => setTab("preview")}>预览</button>
        <button type="button" className="md-tool" onClick={() => fileRef.current?.click()} disabled={tab !== "edit"}>
          🖼 插入图片
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_IMAGES}
          multiple
          hidden
          onChange={(e) => {
            void insertImages([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <span className="hint">支持 Markdown；图片可点按钮、直接粘贴或拖进编辑框</span>
      </div>
      <textarea
        ref={textareaRef}
        id={name}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onPaste={(e) => {
          const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
          if (files.length) {
            e.preventDefault();
            void insertImages(files);
          }
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          setDragging(false);
          const files = [...e.dataTransfer.files];
          if (files.length) {
            e.preventDefault();
            void insertImages(files);
          }
        }}
        className={dragging ? "dragging" : undefined}
        rows={22}
        hidden={tab !== "edit"}
      />
      {tab === "preview" && <div className="article-body md-preview" dangerouslySetInnerHTML={{ __html: html }} />}
      <div className="md-status" role="status" aria-live="polite">
        {uploading > 0 && <span>正在上传 {uploading} 张图片…（上传完成前请不要保存）</span>}
        {error && <span className="md-error">{error}</span>}
      </div>
    </div>
  );
}
