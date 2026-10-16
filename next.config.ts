import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 部署：产出最小化的独立运行包（.next/standalone）
  output: "standalone",
  // sharp 的 libvips 动态库由系统加载器载入，文件追踪发现不了，需显式打进 standalone 产物
  outputFileTracingIncludes: {
    "/api/upload": ["./node_modules/.pnpm/@img+*/node_modules/@img/**/*"],
    "/api/mcp": ["./node_modules/.pnpm/@img+*/node_modules/@img/**/*"],
  },
  // Docker 构建时由 NEXT_BUILD_CPUS 限制并发 worker 数，避免小内存服务器构建时内存耗尽
  ...(process.env.NEXT_BUILD_CPUS ? { experimental: { cpus: Number(process.env.NEXT_BUILD_CPUS) } } : {}),
  poweredByHeader: false,
  compress: true,
  async rewrites() {
    return [
      // 伪静态：文章 Markdown 版本，供 AI / LLM 直接抓取纯文本，例如 /news/12.md
      { source: "/:channel/:id(\\d+).md", destination: "/api/md/:id" },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // 后台不允许任何搜索引擎 / AI 收录
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
