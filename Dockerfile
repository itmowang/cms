# syntax=docker/dockerfile:1
# menhu-cms 生产镜像（Next.js standalone），数据在 PostgreSQL 中，镜像内不保存任何线上数据。
# 构建：DATABASE_URL=... docker build --network host --secret id=database_url,env=DATABASE_URL -t menhu-cms .

ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS base
ARG NPM_REGISTRY=https://registry.npmjs.org
ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    COREPACK_NPM_REGISTRY=${NPM_REGISTRY}
# 按 package.json 中的 packageManager 字段启用固定版本的 pnpm
RUN corepack enable
WORKDIR /app

# ---------- 依赖 ----------
FROM base AS deps
ARG NPM_REGISTRY=https://registry.npmjs.org
COPY package.json pnpm-lock.yaml ./
RUN pnpm config set registry "${NPM_REGISTRY}" && pnpm install --frozen-lockfile

# ---------- 构建 ----------
FROM base AS builder
# NEXT_PUBLIC_* 在构建期内联，必须作为构建参数传入
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NODE_ENV=production \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    # 小内存服务器：限制 Node 堆大小、静态页生成只用 1 个 worker，超限时直接报错而不是拖垮机器
    NODE_OPTIONS=--max-old-space-size=768 \
    NEXT_BUILD_CPUS=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 构建期预渲染需要读数据库：连接串通过 BuildKit secret 传入，不会写进镜像层或构建历史。
# 部署脚本使用 --network host 构建，连接本机 127.0.0.1:5432 的线上库（只读查询）。
RUN --mount=type=secret,id=database_url,env=DATABASE_URL pnpm build

# ---------- 运行 ----------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000

HEALTHCHECK --interval=5s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
