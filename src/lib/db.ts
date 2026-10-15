import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createSeed } from "./seed";
import type { Database } from "./types";

/**
 * 轻量 JSON 文件存储：零依赖、开箱即用。
 * 所有读写都经过本模块，后续如需切换到 MySQL / PostgreSQL，只需替换本文件 + repo.ts。
 */
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

let cache: { mtimeMs: number; data: Database } | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

let ensuring: Promise<void> | null = null;

/** 只初始化一次，避免首次启动时并发请求同时写种子数据 */
function ensureFile(): Promise<void> {
  ensuring ??= (async () => {
    try {
      await fs.access(DB_FILE);
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await atomicWrite(createSeed());
    }
  })().catch((e) => {
    ensuring = null;
    throw e;
  });
  return ensuring;
}

let tmpSeq = 0;

async function atomicWrite(data: Database): Promise<void> {
  const tmp = `${DB_FILE}.${process.pid}.${Date.now()}.${++tmpSeq}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  // Windows 下目标文件被其他进程短暂占用时 rename 会报 EPERM/EBUSY，重试几次
  for (let i = 0; ; i++) {
    try {
      await fs.rename(tmp, DB_FILE);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (i >= 5 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) {
        await fs.rm(tmp, { force: true });
        throw e;
      }
      await new Promise((r) => setTimeout(r, 30 * (i + 1)));
    }
  }
}

export async function readDb(): Promise<Database> {
  await ensureFile();
  const stat = await fs.stat(DB_FILE);
  if (cache && cache.mtimeMs === stat.mtimeMs) return cache.data;
  const raw = await fs.readFile(DB_FILE, "utf8");
  const data = JSON.parse(raw) as Database;
  cache = { mtimeMs: stat.mtimeMs, data };
  return data;
}

/** 串行化写操作，避免并发请求互相覆盖 */
export function writeDb<T>(mutator: (db: Database) => T | Promise<T>): Promise<T> {
  const run = async () => {
    // 写之前总是从磁盘读取最新数据，并深拷贝避免污染读缓存
    const db = structuredClone(await readDb());
    const result = await mutator(db);
    await atomicWrite(db);
    cache = null;
    return result;
  };
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => undefined);
  return next;
}
