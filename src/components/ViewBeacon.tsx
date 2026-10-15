"use client";

import { useEffect } from "react";

/** 页面是静态缓存的，点击量通过客户端信标异步上报，不影响静态化 */
export function ViewBeacon({ id }: { id: number }) {
  useEffect(() => {
    const key = `viewed:${id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    navigator.sendBeacon?.(`/api/hit/${id}`) || fetch(`/api/hit/${id}`, { method: "POST", keepalive: true });
  }, [id]);
  return null;
}
