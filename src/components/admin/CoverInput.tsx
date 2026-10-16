"use client";

import { useRef, useState } from "react";
import { ACCEPT_IMAGES, formatBytes, uploadImage } from "./upload";

/** 封面图：可直接填 URL，也可上传（上传后自动填入站内地址） */
export function CoverInput({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await uploadImage(file);
      setValue(r.path);
      setMsg({ text: `已上传 ${r.width}×${r.height}，${formatBytes(r.bytes)}` });
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  const previewable = /^(https?:\/\/|\/)/.test(value);

  return (
    <div className="cover-input">
      <label htmlFor={`${name}-input`}>封面图（菜谱富结果需要图片，建议 4:3 或 16:9）</label>
      <div className="cover-row">
        <input
          id={`${name}-input`}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="上传，或填写 https://… 地址"
          maxLength={500}
        />
        <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? "上传中…" : "上传"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_IMAGES}
          hidden
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {msg && <p className={msg.error ? "md-error" : "hint"} role="status">{msg.text}</p>}
      {previewable && (
        <div className="cover-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="封面预览" />
          <button type="button" className="link danger" onClick={() => { setValue(""); setMsg(null); }}>移除封面</button>
        </div>
      )}
    </div>
  );
}
