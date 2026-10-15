import "server-only";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { articleToMarkdown } from "@/lib/feed";
import { pushUrls } from "@/lib/push";
import * as repo from "@/lib/repo";
import * as svc from "@/lib/services";
import type { Article, Channel } from "@/lib/types";
import { absUrl, articleMdUrl, articleUrl, channelUrl, SITE_URL, toChannelMap } from "@/lib/urls";

/**
 * 权限范围：
 * - admin：全部工具（内容管理、频道、站点设置、推送收录）
 * - read ：只读工具，且只能看到前台已公开的文章（适合给 AI 助手、合作方、内容聚合使用）
 */
export type McpScope = "admin" | "read";

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

const ok = (data: unknown): ToolResult => ({
  content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
});
const fail = (msg: string): ToolResult => ({ content: [{ type: "text", text: msg }], isError: true });

/** 统一错误处理：业务错误返回给模型可读的提示，而不是让请求整体失败 */
function safe<A>(fn: (args: A) => Promise<ToolResult>) {
  return async (args: A): Promise<ToolResult> => {
    try {
      return await fn(args);
    } catch (e) {
      if (e instanceof svc.ValidationError) return fail(`操作失败：${e.message}`);
      console.error("[mcp] tool error", e);
      return fail(`服务器内部错误：${(e as Error).message}`);
    }
  };
}

/* ---------------- 输出格式 ---------------- */

function articleBrief(a: Article, map: Map<number, Channel>) {
  const c = map.get(a.channelId);
  return {
    id: a.id,
    title: a.title,
    channelId: a.channelId,
    channel: c?.name,
    status: a.status,
    publishedAt: a.publishedAt,
    tags: a.tags,
    views: a.views,
    isHeadline: a.isHeadline,
    isFocus: a.isFocus,
    url: c ? absUrl(articleUrl(a, c)) : undefined,
  };
}

function articleFull(a: Article, c: Channel | undefined) {
  return {
    ...a,
    channel: c?.name,
    url: c ? absUrl(articleUrl(a, c)) : undefined,
    markdownUrl: c ? absUrl(articleMdUrl(a, c)) : undefined,
  };
}

/* ---------------- 参数 Schema ---------------- */

const articleFieldShape = {
  title: z.string().min(1).max(120).describe("标题，最多 120 字"),
  shortTitle: z.string().max(40).optional().describe("短标题，首页密集列表展示用"),
  channelId: z.number().int().positive().describe("频道 ID，用 list_channels 获取"),
  summary: z.string().max(500).optional().describe("摘要，80-150 字为佳；用作 description 与 AI 摘要"),
  content: z.string().max(200_000).optional().describe("正文，Markdown 格式（不支持原始 HTML）"),
  cover: z.string().max(500).optional().describe("封面图 URL，http(s):// 或站内 / 开头"),
  author: z.string().max(50).optional(),
  source: z.string().max(50).optional().describe("来源，如：本站、新华网"),
  tags: z.array(z.string().max(20)).max(10).optional().describe("标签，最多 10 个"),
  isHeadline: z.boolean().optional().describe("是否首页头条"),
  isFocus: z.boolean().optional().describe("是否首页焦点图"),
  status: z.enum(["draft", "published"]).optional().describe("draft 草稿 / published 发布，默认 draft"),
  publishedAt: z
    .string()
    .optional()
    .describe("发布时间。ISO 8601，或 'YYYY-MM-DDTHH:mm'（按北京时间）。设为未来时间即定时发布"),
};

const channelFieldShape = {
  name: z.string().min(1).max(20).describe("频道名称，如：科技"),
  slug: z.string().regex(/^[a-z][a-z0-9-]{1,29}$/).describe("URL 目录名，如 tech → /tech/123.html"),
  description: z.string().max(300).optional().describe("频道描述（SEO description）"),
  keywords: z.string().max(200).optional().describe("频道关键词，逗号分隔"),
  sort: z.number().int().optional().describe("排序，越小越靠前"),
  showInNav: z.boolean().optional().describe("是否显示在顶部导航"),
};

/* ---------------- 构建 Server ---------------- */

export function createMcpServer(scope: McpScope): McpServer {
  const server = new McpServer(
    { name: "menhu-cms", title: "门户 CMS", version: "0.1.0" },
    {
      instructions:
        `这是中文门户网站 CMS（${SITE_URL}）的 MCP 接口，当前权限：${scope === "admin" ? "管理员（可读写）" : "只读"}。\n` +
        "常用流程：list_channels 获取频道 → search_articles / list_articles 查文章 → get_article 读全文。" +
        (scope === "admin"
          ? "\n写入：create_article 默认存为草稿，确认无误后用 set_article_status 发布。发布会自动刷新静态页并推送搜索引擎。删除操作不可恢复，执行前请与用户确认。"
          : ""),
    },
  );

  const isAdmin = scope === "admin";

  /* ===== 只读工具（两种权限都有） ===== */

  server.registerTool(
    "get_site_info",
    {
      title: "站点信息",
      description: "获取站点名称、描述、统计数据，以及 sitemap / RSS / llms.txt 等 SEO 与 AI 抓取入口地址",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    safe(async () => {
      const [settings, stats] = await Promise.all([repo.getSettings(), repo.stats()]);
      return ok({
        siteUrl: SITE_URL,
        settings,
        stats: isAdmin ? stats : { channels: stats.channels, published: stats.published },
        endpoints: {
          sitemap: `${SITE_URL}/sitemap.xml`,
          newsSitemap: `${SITE_URL}/news-sitemap.xml`,
          rss: `${SITE_URL}/rss.xml`,
          llms: `${SITE_URL}/llms.txt`,
          llmsFull: `${SITE_URL}/llms-full.txt`,
          robots: `${SITE_URL}/robots.txt`,
        },
        urlRules: {
          channel: "/{slug}",
          channelPage: "/{slug}/list_{page}.html",
          article: "/{slug}/{id}.html",
          articleMarkdown: "/{slug}/{id}.md",
          tag: "/tag/{tag}.html",
        },
      });
    }),
  );

  server.registerTool(
    "list_channels",
    {
      title: "频道列表",
      description: "列出所有频道（ID、名称、URL 目录、描述、排序）",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    safe(async () => {
      const channels = await repo.listChannels();
      return ok(channels.map((c) => ({ ...c, url: absUrl(channelUrl(c)) })));
    }),
  );

  server.registerTool(
    "list_articles",
    {
      title: "文章列表",
      description: isAdmin
        ? "分页列出文章（含草稿和定时发布），按 ID 倒序。可按标题关键词、频道、状态筛选。不返回正文"
        : "分页列出已公开的文章，按 ID 倒序。可按标题关键词、频道筛选。不返回正文",
      inputSchema: {
        keyword: z.string().max(50).optional().describe("标题关键词"),
        channelId: z.number().int().positive().optional(),
        ...(isAdmin ? { status: z.enum(["draft", "published"]).optional() } : {}),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    safe(async (args: { keyword?: string; channelId?: number; status?: Article["status"]; page: number; pageSize: number }) => {
      const [res, channels] = await Promise.all([
        repo.adminListArticles({ ...args, status: isAdmin ? args.status : undefined, visibleOnly: !isAdmin }),
        repo.listChannels(),
      ]);
      const map = toChannelMap(channels);
      return ok({ page: args.page, totalPages: res.totalPages, total: res.total, items: res.items.map((a) => articleBrief(a, map)) });
    }),
  );

  server.registerTool(
    "search_articles",
    {
      title: "全文搜索",
      description: "在已公开文章的标题、摘要、标签、正文中全文搜索，按发布时间倒序",
      inputSchema: {
        query: z.string().min(1).max(50).describe("搜索关键词"),
        limit: z.number().int().min(1).max(50).default(10),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    safe(async ({ query, limit }: { query: string; limit: number }) => {
      const [items, channels] = await Promise.all([repo.searchArticles(query, limit), repo.listChannels()]);
      const map = toChannelMap(channels);
      return ok(items.map((a) => ({ ...articleBrief(a, map), summary: a.summary })));
    }),
  );

  server.registerTool(
    "get_article",
    {
      title: "读取文章",
      description: "按 ID 读取单篇文章。format=markdown 返回带 front matter 的 Markdown 全文（适合阅读/引用）；format=json 返回全部字段（适合编辑前读取）",
      inputSchema: {
        id: z.number().int().positive(),
        format: z.enum(["markdown", "json"]).default("markdown"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    safe(async ({ id, format }: { id: number; format: "markdown" | "json" }) => {
      const a = isAdmin ? await repo.adminGetArticle(id) : await repo.getPublishedArticle(id);
      if (!a) return fail(`文章 ${id} 不存在${isAdmin ? "" : "或未公开"}`);
      const c = await repo.getChannelById(a.channelId);
      if (format === "json") return ok(articleFull(a, c));
      if (!c) return fail("文章所属频道不存在");
      const s = await repo.getSettings();
      return ok(articleToMarkdown(a, c, s.name));
    }),
  );

  server.registerTool(
    "get_hot_articles",
    {
      title: "热门 / 最新文章",
      description: "获取热门排行（按阅读量）或最新发布的已公开文章，可限定频道",
      inputSchema: {
        sort: z.enum(["hot", "latest"]).default("hot"),
        channelId: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(50).default(10),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    safe(async ({ sort, channelId, limit }: { sort: "hot" | "latest"; channelId?: number; limit: number }) => {
      const [items, channels] = await Promise.all([
        sort === "hot" ? repo.hotArticles(limit, channelId) : repo.latestArticles(limit, channelId),
        repo.listChannels(),
      ]);
      const map = toChannelMap(channels);
      return ok(items.map((a) => articleBrief(a, map)));
    }),
  );

  /* ===== 资源 ===== */

  server.registerResource(
    "channels",
    "cms://channels",
    { title: "频道列表", description: "全部频道", mimeType: "application/json" },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await repo.listChannels(), null, 2) }],
    }),
  );

  server.registerResource(
    "article",
    new ResourceTemplate("cms://articles/{id}", { list: undefined }),
    { title: "文章（Markdown）", description: "按 ID 读取已公开文章的 Markdown 全文", mimeType: "text/markdown" },
    async (uri, { id }) => {
      const a = await repo.getPublishedArticle(Number(id));
      const c = a && (await repo.getChannelById(a.channelId));
      if (!a || !c) throw new Error(`文章 ${id} 不存在或未公开`);
      const s = await repo.getSettings();
      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: articleToMarkdown(a, c, s.name) }] };
    },
  );

  /* ===== 提示词模板 ===== */

  server.registerPrompt(
    "write_news",
    {
      title: "撰写新闻稿",
      description: "根据主题和素材撰写一篇符合门户规范、对 SEO 和 AI 抓取友好的新闻稿",
      argsSchema: {
        topic: z.string().describe("新闻主题"),
        materials: z.string().optional().describe("素材、要点或原始资料"),
        channel: z.string().optional().describe("目标频道名称，如：科技"),
      },
    },
    ({ topic, materials, channel }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `请为门户网站${channel ? `「${channel}」频道` : ""}撰写一篇新闻稿，主题：${topic}。`,
              materials ? `\n素材：\n${materials}` : "",
              "\n要求：",
              "1. 标题 20-30 字，包含核心关键词，不做标题党；",
              "2. 摘要 80-150 字，一段话讲清 5W（何时、何地、何人、何事、为何）；",
              "3. 正文使用 Markdown，导语先行，用 ## 小标题分 2-4 节，段落简短；事实与观点分开，引用注明出处；",
              "4. 给出 3-5 个标签；",
              "5. 不要编造数据、人名、机构和引语，素材不足处用【待补充】标注。",
              isAdmin
                ? "\n完成后先调用 list_channels 确认 channelId，再调用 create_article 以草稿（status=draft）保存，并把文章 ID 告诉我。"
                : "",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "seo_review",
    {
      title: "文章 SEO 体检",
      description: "读取指定文章，从搜索引擎与 AI 引用角度给出优化建议",
      argsSchema: { id: z.string().describe("文章 ID") },
    },
    ({ id }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `请先调用 get_article（id=${id}, format=json）读取文章，然后从以下方面评估并给出可直接替换的修改建议：\n` +
              "标题（长度、关键词前置）、摘要（是否可独立成为 AI 答案片段）、小标题结构、首段信息密度、标签、内链机会、事实是否有出处。" +
              (isAdmin ? "\n给出建议后询问我是否需要用 update_article 应用修改。" : ""),
          },
        },
      ],
    }),
  );

  if (!isAdmin) return server;

  /* ===== 管理工具（仅 admin） ===== */

  server.registerTool(
    "create_article",
    {
      title: "新建文章",
      description: "新建文章，默认保存为草稿。status=published 会立即发布（或在 publishedAt 到达时发布），并刷新静态页、推送搜索引擎",
      inputSchema: articleFieldShape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    safe(async (args: svc.ArticleFields) => {
      const r = await svc.upsertArticle(undefined, { status: "draft", ...args });
      return ok({ message: "已创建", id: r.article.id, status: r.article.status, url: r.url, push: r.push });
    }),
  );

  server.registerTool(
    "update_article",
    {
      title: "修改文章",
      description: "按 ID 局部修改文章，只更新传入的字段，其余保持不变",
      inputSchema: { id: z.number().int().positive(), ...z.object(articleFieldShape).partial().shape },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    safe(async ({ id, ...fields }: svc.ArticleFields & { id: number }) => {
      const r = await svc.upsertArticle(id, fields);
      return ok({ message: "已更新", id: r.article.id, status: r.article.status, url: r.url, push: r.push });
    }),
  );

  server.registerTool(
    "set_article_status",
    {
      title: "发布 / 撤回文章",
      description: "发布（published）或撤回为草稿（draft）。发布时可选指定 publishedAt 实现定时发布",
      inputSchema: {
        id: z.number().int().positive(),
        status: z.enum(["draft", "published"]),
        publishedAt: articleFieldShape.publishedAt,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    safe(async ({ id, status, publishedAt }: { id: number; status: Article["status"]; publishedAt?: string }) => {
      const r = await svc.upsertArticle(id, { status, ...(publishedAt ? { publishedAt } : {}) });
      return ok({ message: status === "published" ? "已发布" : "已撤回为草稿", id, publishedAt: r.article.publishedAt, url: r.url, push: r.push });
    }),
  );

  server.registerTool(
    "delete_article",
    {
      title: "删除文章",
      description: "永久删除文章，不可恢复。调用前务必与用户确认",
      inputSchema: { id: z.number().int().positive() },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    safe(async ({ id }: { id: number }) => {
      const a = await svc.removeArticle(id);
      return ok({ message: `已删除「${a.title}」`, id });
    }),
  );

  server.registerTool(
    "create_channel",
    {
      title: "新建频道",
      description: "新建频道。slug 即伪静态 URL 目录",
      inputSchema: channelFieldShape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    safe(async (args: svc.ChannelFields) => ok({ message: "已创建", channel: await svc.upsertChannel(undefined, args) })),
  );

  server.registerTool(
    "update_channel",
    {
      title: "修改频道",
      description: "按 ID 局部修改频道。注意：修改 slug 会导致该频道所有旧文章链接 404",
      inputSchema: { id: z.number().int().positive(), ...z.object(channelFieldShape).partial().shape },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    safe(async ({ id, ...fields }: svc.ChannelFields & { id: number }) =>
      ok({ message: "已更新", channel: await svc.upsertChannel(id, fields) }),
    ),
  );

  server.registerTool(
    "delete_channel",
    {
      title: "删除频道",
      description: "删除频道（频道下必须没有文章）。调用前务必与用户确认",
      inputSchema: { id: z.number().int().positive() },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    safe(async ({ id }: { id: number }) => {
      await svc.removeChannel(id);
      return ok({ message: "已删除", id });
    }),
  );

  server.registerTool(
    "update_settings",
    {
      title: "修改站点设置",
      description: "局部修改站点名称、TDK、备案号、版权、友情链接等。friendLinks 传入时整体替换",
      inputSchema: {
        name: z.string().min(1).max(50).optional(),
        logoText: z.string().max(20).optional(),
        slogan: z.string().max(50).optional(),
        description: z.string().max(300).optional(),
        keywords: z.string().max(200).optional(),
        icp: z.string().max(50).optional(),
        copyright: z.string().max(100).optional(),
        friendLinks: z.array(z.object({ name: z.string().max(30), url: z.string().url() })).max(50).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    safe(async (args: svc.SettingsFields) => ok({ message: "已更新", settings: await svc.patchSettings(args) })),
  );

  server.registerTool(
    "push_to_search_engines",
    {
      title: "推送收录",
      description: "手动把站内 URL 推送给百度普通收录 API 与 IndexNow（需在环境变量中配置），用于补推历史文章",
      inputSchema: { urls: z.array(z.string().url()).min(1).max(100).describe("完整 URL，必须是本站地址") },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    safe(async ({ urls }: { urls: string[] }) => {
      const own = urls.filter((u) => u.startsWith(`${SITE_URL}/`) || u === SITE_URL);
      if (own.length !== urls.length) return fail(`只能推送本站地址（${SITE_URL}）`);
      const logs = await pushUrls(own);
      return ok(logs.length ? logs : "未配置 BAIDU_PUSH_API / INDEXNOW_KEY，未推送");
    }),
  );

  server.registerTool(
    "refresh_cache",
    {
      title: "刷新静态缓存",
      description: "让全站 ISR 静态页立即失效重建（直接改了数据文件等场景使用）",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    safe(async () => {
      svc.refreshSite();
      return ok("已刷新");
    }),
  );

  return server;
}
