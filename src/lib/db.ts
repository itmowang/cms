import "server-only";
import { Pool, type QueryResultRow } from "pg";

/**
 * PostgreSQL 连接池。所有 SQL 都经过本模块 + repo.ts。
 * 表结构见 db/migrations/*.sql，由 db/migrate.sh 执行（部署脚本自动调用）。
 */
const g = globalThis as unknown as { __menhuPool?: Pool };

function pool(): Pool {
  if (!g.__menhuPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("未配置 DATABASE_URL（例如 postgres://menhu:menhu@127.0.0.1:5432/menhu）");
    const p = new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX) || 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    // 空闲连接断开（如数据库重启）不应让进程崩溃，下次查询会自动重连
    p.on("error", (e) => console.error("[db] 空闲连接异常：", e.message));
    // 开发环境热更新会重复执行模块，挂在 globalThis 上避免连接泄漏
    g.__menhuPool = p;
  }
  return g.__menhuPool;
}

/** 参数化查询，返回行数组。永远使用 $1、$2 占位符，不要拼接用户输入 */
export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await pool().query<T>(text, params)).rows;
}

export async function queryOne<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await query<T>(text, params))[0];
}

/** PostgreSQL 错误码（23505 唯一约束冲突、23503 外键约束等） */
export function pgCode(e: unknown): string | undefined {
  return typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : undefined;
}
