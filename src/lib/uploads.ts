import "server-only";
import { createHash } from "node:crypto";
import { lookup } from "node:dns";
import { promises as fs } from "node:fs";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import path from "node:path";
import sharp from "sharp";

/**
 * 图片上传：后台编辑器（/api/upload）与 MCP（upload_image）共用。
 *
 * - 按文件内容（魔数）识别格式，只接受 JPEG / PNG / WebP / GIF / AVIF，拒绝 SVG 等可执行内容
 * - 自动转正方向、去掉 EXIF（含 GPS 定位）、限制最长边、统一转 WebP；GIF 原样保存以保留动画
 * - 文件名为内容哈希：相同图片只存一份，URL 永不变化，可长期缓存
 * - 存储在 UPLOAD_DIR（默认 ./uploads），对外地址 /uploads/YYYY/MM/<hash>.<ext>
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 2000;
const MAX_INPUT_PIXELS = 50_000_000; // 防解压炸弹
const WEBP_QUALITY = 82;

// turbopackIgnore：运行时目录，不要让构建期文件追踪把整个项目打进 standalone 产物
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads");

sharp.concurrency(1); // 小内存服务器：同一时刻只处理一张

export class UploadError extends Error {}

export const MIME: Record<string, string> = {
  webp: "image/webp",
  gif: "image/gif",
  jpg: "image/jpeg",
  png: "image/png",
  avif: "image/avif",
};

type Kind = "jpeg" | "png" | "webp" | "gif" | "avif";

function sniff(b: Buffer): Kind | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (b.toString("ascii", 0, 6) === "GIF87a" || b.toString("ascii", 0, 6) === "GIF89a") return "gif";
  if (b.toString("ascii", 4, 8) === "ftyp" && /^(avif|avis)$/.test(b.toString("ascii", 8, 12))) return "avif";
  return null;
}

export interface SavedImage {
  /** 站内路径，如 /uploads/2026/10/ab12….webp */
  path: string;
  width: number;
  height: number;
  bytes: number;
  type: string;
}

export async function saveImage(input: Buffer): Promise<SavedImage> {
  if (!input.length) throw new UploadError("文件为空");
  if (input.length > MAX_UPLOAD_BYTES) throw new UploadError(`图片不能超过 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB`);
  const kind = sniff(input);
  if (!kind) throw new UploadError("只支持 JPG、PNG、WebP、GIF、AVIF 图片");

  let out: Buffer;
  let ext: string;
  let width: number;
  let height: number;
  try {
    if (kind === "gif") {
      // GIF 保留动画，不重新编码（只校验能正常解码）
      const meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
      out = input;
      ext = "gif";
      width = meta.width ?? 0;
      height = meta.pageHeight ?? meta.height ?? 0;
    } else {
      const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate() // 按 EXIF 方向转正（之后元数据会被丢弃）
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });
      out = data;
      ext = "webp";
      width = info.width;
      height = info.height;
    }
  } catch (e) {
    if (e instanceof UploadError) throw e;
    throw new UploadError(`图片无法解析：${(e as Error).message}`);
  }

  const hash = createHash("sha256").update(out).digest("hex").slice(0, 32);
  const now = new Date();
  const dir = path.join(String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0"));
  const file = `${hash}.${ext}`;
  const abs = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, dir, file);

  await fs.mkdir(path.dirname(abs), { recursive: true });
  try {
    // wx：已存在（同一张图）则不覆盖
    await fs.writeFile(abs, out, { flag: "wx" });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  return { path: `/uploads/${dir.split(path.sep).join("/")}/${file}`, width, height, bytes: out.length, type: MIME[ext] };
}

/* ---------------- 读取（开发环境 / 无 Caddy 时由 Next 路由提供） ---------------- */

const SEGMENT_RULES = [/^\d{4}$/, /^\d{2}$/, /^[a-f0-9]{16,64}\.(webp|gif|jpg|png|avif)$/];

export async function readUpload(segments: string[]): Promise<{ data: Buffer; type: string } | null> {
  if (segments.length !== 3 || !segments.every((s, i) => SEGMENT_RULES[i].test(s))) return null;
  try {
    const data = await fs.readFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, ...segments));
    return { data, type: MIME[segments[2].split(".").pop()!] };
  } catch {
    return null;
  }
}

/* ---------------- 远程图片下载（MCP 用，防 SSRF） ---------------- */

/** 是否为不允许访问的内网 / 保留地址 */
export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // 链路本地 / 云厂商元数据
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
  if (mapped) return isPrivateIp(mapped[1]);
  return /^(fc|fd|fe[89ab]|ff)/.test(v6) || v6.startsWith("64:ff9b:") || v6.startsWith("2001:db8:");
}

/** 连接前校验解析出的真实 IP，防止 DNS 重绑定绕过 */
const safeLookup: typeof lookup = ((hostname: string, options: object, callback: (...args: unknown[]) => void) => {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = addresses as Array<{ address: string; family: number }>;
    const bad = list.find((a) => isPrivateIp(a.address));
    if (bad || !list.length) return callback(new UploadError(`不允许访问内网地址：${hostname}`));
    const opts = options as { all?: boolean };
    if (opts.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}) as typeof lookup;

function getOnce(url: URL): Promise<{ status: number; location?: string; body?: Buffer }> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.get(
      url,
      { lookup: safeLookup, timeout: 15_000, headers: { "User-Agent": "menhu-cms-image-fetcher/1.0", Accept: "image/*" } },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location });
        }
        if (status !== 200) {
          res.resume();
          return reject(new UploadError(`下载图片失败：HTTP ${status}`));
        }
        const declared = Number(res.headers["content-length"] || 0);
        if (declared > MAX_UPLOAD_BYTES) {
          res.destroy();
          return reject(new UploadError("远程图片超过 10MB"));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_UPLOAD_BYTES) {
            res.destroy();
            reject(new UploadError("远程图片超过 10MB"));
          } else chunks.push(c);
        });
        res.on("end", () => resolve({ status, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new UploadError("下载图片超时")));
    req.on("error", (e) => reject(e instanceof UploadError ? e : new UploadError(`下载图片失败：${e.message}`)));
  });
}

export async function fetchRemoteImage(raw: string): Promise<Buffer> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UploadError("图片地址格式不正确");
  }
  for (let i = 0; i <= 3; i++) {
    if (!/^https?:$/.test(url.protocol)) throw new UploadError("只支持 http(s) 图片地址");
    if (url.username || url.password) throw new UploadError("图片地址不能包含账号密码");
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(host) && isPrivateIp(host)) throw new UploadError("不允许访问内网地址");
    const r = await getOnce(url);
    if (r.body) return r.body;
    if (!r.location) throw new UploadError("下载图片失败：重定向缺少地址");
    url = new URL(r.location, url); // 每一跳都重新校验
  }
  throw new UploadError("下载图片失败：重定向次数过多");
}

/** 解析 base64 或 data URL */
export function decodeBase64Image(data: string): Buffer {
  const m = /^data:[^;,]+;base64,(.*)$/s.exec(data.trim());
  const b64 = (m ? m[1] : data).replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(b64)) throw new UploadError("base64 数据格式不正确");
  if (b64.length > Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 4) throw new UploadError("图片不能超过 10MB");
  return Buffer.from(b64, "base64");
}
