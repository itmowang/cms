export function Notice({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <p className="notice error" role="alert">{error}</p>;
  if (ok) return <p className="notice ok" role="status">保存成功，前台页面已刷新。</p>;
  return null;
}

export type AdminSearchParams = Promise<Record<string, string | string[] | undefined>>;

export const sp = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
