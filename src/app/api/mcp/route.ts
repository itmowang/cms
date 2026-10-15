import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { safeEqual } from "@/lib/auth";
import { createMcpServer, type McpScope } from "@/lib/mcp/server";

/**
 * MCP 端点（Streamable HTTP，无状态模式）：POST /api/mcp
 *
 * 鉴权：Authorization: Bearer <token>
 *   MCP_TOKEN           -> 管理员权限（读写）
 *   MCP_READONLY_TOKEN  -> 只读权限（只能读取已公开内容）
 * 两个都没配置时端点关闭。
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIN_TOKEN_LEN = 24;

async function resolveScope(req: Request): Promise<McpScope | null> {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  const token = m?.[1].trim();
  if (!token) return null;
  const admin = process.env.MCP_TOKEN;
  const readonly = process.env.MCP_READONLY_TOKEN;
  if (admin && admin.length >= MIN_TOKEN_LEN && (await safeEqual(token, admin))) return "admin";
  if (readonly && readonly.length >= MIN_TOKEN_LEN && (await safeEqual(token, readonly))) return "read";
  return null;
}

const jsonRpcError = (status: number, code: number, message: string, headers?: Record<string, string>) =>
  Response.json({ jsonrpc: "2.0", error: { code, message }, id: null }, { status, headers });

async function handle(req: Request): Promise<Response> {
  const configured = [process.env.MCP_TOKEN, process.env.MCP_READONLY_TOKEN].some((t) => t && t.length >= MIN_TOKEN_LEN);
  if (!configured) {
    return jsonRpcError(503, -32000, `MCP 未启用：请在环境变量中配置 MCP_TOKEN 或 MCP_READONLY_TOKEN（至少 ${MIN_TOKEN_LEN} 位）`);
  }

  const scope = await resolveScope(req);
  if (!scope) {
    await new Promise((r) => setTimeout(r, 300)); // 减缓 token 爆破
    return jsonRpcError(401, -32001, "Unauthorized：缺少或无效的 Bearer token", {
      "WWW-Authenticate": 'Bearer realm="menhu-cms-mcp"',
    });
  }

  // 无状态：每个请求一个 server + transport，天然支持多实例 / Serverless 部署
  const server = createMcpServer(scope);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // JSON 响应模式下 handleRequest 返回时响应体已就绪，可以安全关闭
    void transport.close();
    void server.close();
  }
}

export { handle as GET, handle as POST, handle as DELETE };
