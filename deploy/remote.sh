#!/usr/bin/env bash
# =============================================================================
# menhu-cms 服务器端部署脚本（Ubuntu 24.04，root 运行）
# 由本地 deploy.sh 上传并调用，也可以在服务器上直接执行：
#   bash /opt/menhu-cms/remote.sh status|logs|backup|rollback
#
# 数据安全策略：
#   1. 数据库文件在 $APP_DIR/pgdata（宿主机目录挂载），部署永远不会覆盖或删除它
#   2. 每次部署前自动 pg_dump 备份到 $APP_DIR/backups（保留最近 N 份）
#   3. 先迁移表结构、构建新镜像，失败时线上容器完全不受影响
#   4. 新容器健康检查不通过则自动回滚到上一个镜像
#   5. app.env（密钥、后台密码、数据库密码）只在缺失时生成，已有的值永不覆盖
#   6. 从旧版 JSON 存储升级时：先导入一次用于构建，切换前停掉旧服务再完整同步一次，
#      保证切换期间写入的数据不丢；原 data/db.json 原样保留
# =============================================================================
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/menhu-cms}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"
KEEP_BACKUPS="${KEEP_BACKUPS:-30}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org}"
DOCKER_MIRROR="${DOCKER_MIRROR:-}"
DEFAULT_SITE_URL="${DEFAULT_SITE_URL:-http://localhost}"
DB_PORT="${DB_PORT:-5432}"
IMAGE_NAME="${IMAGE_NAME:-menhu-cms}"
APP_UID=1000 # 镜像内 node 用户

log()  { printf '\033[1;32m[%s]\033[0m %s\n' "$(date +%H:%M:%S)" "$*"; }
warn() { printf '\033[1;33m[警告]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[错误]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "需要 root 权限（非 root 用户请配置免密 sudo）"

COMPOSE_ARGS=(--project-directory "$APP_DIR" -f "$APP_DIR/docker-compose.yml")
compose() { docker compose "${COMPOSE_ARGS[@]}" "$@"; }
psql_db() { compose exec -T db psql -X -q -tA -v ON_ERROR_STOP=1 -U menhu -d menhu "$@"; }

# 从 app.env 读取变量（不 source，避免特殊字符被 shell 解释）
env_get() {
  local v
  v="$(grep -E "^$1=" "$APP_DIR/app.env" 2>/dev/null | tail -n 1 | cut -d= -f2- || true)"
  v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
  printf '%s' "$v"
}

current_tag()  { cat "$APP_DIR/.current_tag" 2>/dev/null || true; }
previous_tag() { cat "$APP_DIR/.previous_tag" 2>/dev/null || true; }

# ---------------------------------------------------------------------------
install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return
  fi
  log "安装 Docker（Ubuntu 官方源）..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y docker.io docker-compose-v2 docker-buildx
  systemctl enable --now docker

  if [ -n "$DOCKER_MIRROR" ] && [ ! -f /etc/docker/daemon.json ]; then
    log "配置 Docker 镜像加速：$DOCKER_MIRROR"
    mkdir -p /etc/docker
    printf '{\n  "registry-mirrors": ["%s"]\n}\n' "$DOCKER_MIRROR" > /etc/docker/daemon.json
    systemctl restart docker
  fi
}

# Next.js 构建比较吃内存，小内存机器自动加 2G swap 防止 OOM
ensure_swap() {
  local mem_kb swap_kb
  mem_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
  swap_kb="$(awk '/SwapTotal/ {print $2}' /proc/meminfo)"
  if [ "$mem_kb" -lt 3000000 ] && [ "$swap_kb" -eq 0 ] && [ ! -f /swapfile ]; then
    log "内存小于 3G 且无 swap，创建 2G /swapfile ..."
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
}

ensure_layout() {
  mkdir -p "$APP_DIR"/{data,pgdata,backups,releases}
  chown "$APP_UID:$APP_UID" "$APP_DIR/data"
  chmod 750 "$APP_DIR/data" "$APP_DIR/backups"
  chmod 700 "$APP_DIR/pgdata"

  if [ ! -f "$APP_DIR/app.env" ]; then
    local pwd
    pwd="$(openssl rand -hex 8)"
    cat > "$APP_DIR/app.env" <<EOF
# menhu-cms 线上配置（仅首次部署生成，之后部署不会覆盖；修改后执行 deploy.sh 重新部署生效）

# 站点对外地址（会在构建期写入页面，改动后需重新部署）。绑定域名后改成 https://你的域名
NEXT_PUBLIC_SITE_URL=${DEFAULT_SITE_URL}

# 绑定的域名（多个用逗号分隔，如 example.com, www.example.com）。
# 填写后 Caddy 自动申请 HTTPS 证书；留空则只提供 HTTP :80
SITE_DOMAIN=

ADMIN_USER=admin
ADMIN_PASSWORD=${pwd}
AUTH_SECRET=$(openssl rand -hex 32)

# BAIDU_PUSH_API=
# INDEXNOW_KEY=
MCP_TOKEN=
MCP_READONLY_TOKEN=
EOF
    log "已生成 $APP_DIR/app.env"
    printf '\n\033[1;36m  后台账号：admin\n  后台密码：%s\n  （保存在服务器 %s/app.env）\033[0m\n\n' "$pwd" "$APP_DIR"
  fi
  # 老配置文件没有数据库密码时追加（只追加，不改动已有内容）
  if [ -z "$(env_get PG_PASSWORD)" ]; then
    printf '\n# PostgreSQL 密码（仅在数据库首次初始化时生效，之后不要修改）\nPG_PASSWORD=%s\n' "$(openssl rand -hex 24)" >> "$APP_DIR/app.env"
    log "已在 app.env 中生成 PG_PASSWORD"
  fi
  chmod 600 "$APP_DIR/app.env"
}

# docker compose 的变量文件（含数据库密码，仅 root 可读）
write_compose_env() {
  local tag="$1" domain primary=""
  # 规范成 Caddy 要求的 "a.com, www.a.com"（逗号后必须有空格）
  domain="$(env_get SITE_DOMAIN | tr ',' ' ' | xargs | sed 's/ /, /g')"
  if [ -n "$domain" ]; then
    # 主域名 = NEXT_PUBLIC_SITE_URL 的主机名，且必须在 SITE_DOMAIN 列表中，否则不做跳转
    primary="$(env_get NEXT_PUBLIC_SITE_URL | sed -E 's#^[a-zA-Z]+://##; s#[/:].*$##')"
    case ",${domain// /}," in *",$primary,"*) ;; *) primary="" ;; esac
  fi
  (
    umask 077
    {
      echo "APP_TAG=$tag"
      echo "SITE_ADDRESS='${domain:-:80}'"
      echo "PRIMARY_HOST=$primary"
      echo "PG_PASSWORD=$(env_get PG_PASSWORD)"
      # 端口可通过环境变量覆盖（同机运行预发布环境时使用）
      echo "IMAGE_NAME=$IMAGE_NAME"
      echo "DB_PORT=$DB_PORT"
      echo "APP_PORT=${APP_PORT:-3000}"
      echo "HTTP_PORT=${HTTP_PORT:-80}"
      echo "HTTPS_PORT=${HTTPS_PORT:-443}"
      if [ -n "${COMPOSE_PROJECT_NAME:-}" ]; then echo "COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME"; fi
    } > "$APP_DIR/.env"
  )
}

db_has_schema() {
  [ "$(psql_db -c "SELECT to_regclass('public.settings') IS NOT NULL" 2>/dev/null || true)" = t ]
}

start_db() {
  compose up -d --wait db >/dev/null
}

trim_backups() {
  ls -1t "$APP_DIR"/backups/$1 2>/dev/null | tail -n +"$((KEEP_BACKUPS + 1))" | xargs -r rm -f || true
}

backup_db() {
  local label="${1:-manual}" out
  if ! db_has_schema; then log "数据库尚未初始化，跳过备份"; return 0; fi
  out="$APP_DIR/backups/pg-$(date +%Y%m%d-%H%M%S)-${label}.dump"
  compose exec -T db pg_dump -U menhu -d menhu -Fc > "$out"
  # 校验备份可以被 pg_restore 正常读取
  [ -s "$out" ] && compose exec -T db pg_restore -l < "$out" >/dev/null || die "数据库备份校验失败：$out"
  log "已备份数据库 → $out（$(du -h "$out" | cut -f1)）"
  trim_backups 'pg-*.dump'
}

backup_json() {
  local f="$APP_DIR/data/db.json" out
  [ -f "$f" ] || return 0
  out="$APP_DIR/backups/db-$(date +%Y%m%d-%H%M%S)-${1:-manual}.json.gz"
  gzip -c "$f" > "$out" && gzip -t "$out" || die "备份文件校验失败：$out"
  log "已备份旧版 JSON 数据 → $out"
}

migrate() {
  bash "$APP_DIR/db/migrate.sh" "$@" -- "${COMPOSE_ARGS[@]}"
}

wait_healthy() {
  local id status waited=0
  id="$(compose ps -q app)"
  [ -n "$id" ] || return 1
  log "等待健康检查（最长 ${HEALTH_TIMEOUT}s）..."
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || echo unknown)"
    case "$status" in
      healthy) return 0 ;;
      exited|dead) return 1 ;;
    esac
    sleep 3; waited=$((waited + 3))
  done
  return 1
}

switch_to() {
  write_compose_env "$1"
  compose up -d --remove-orphans
}

reload_caddy() {
  compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 \
    || compose restart caddy >/dev/null
}

cleanup() {
  local keep_cur keep_prev
  keep_cur="$(current_tag)"; keep_prev="$(previous_tag)"
  # 旧发布目录
  ls -1dt "$APP_DIR"/releases/*/ 2>/dev/null | tail -n +"$((KEEP_RELEASES + 1))" | xargs -r rm -rf || true
  # 旧镜像：只保留当前和上一个（用于回滚）
  docker images "$IMAGE_NAME" --format '{{.Tag}}' | while read -r t; do
    [ "$t" = "$keep_cur" ] || [ "$t" = "$keep_prev" ] || docker rmi "$IMAGE_NAME:$t" >/dev/null 2>&1 || true
  done
  docker image prune -f >/dev/null 2>&1 || true
  docker builder prune -f --filter until=168h >/dev/null 2>&1 || true
}

# ---------------------------------------------------------------------------
cmd_deploy() {
  local tag="${1:?缺少版本号}" src="${2:?缺少源码目录}"
  [ -d "$src" ] || die "源码目录不存在：$src"

  install_docker
  ensure_swap
  ensure_layout

  local release="$APP_DIR/releases/$tag"
  rm -rf "$release"
  mv "$src" "$release"

  # 同步编排配置和脚本（cp 原地覆盖，保持 bind mount 的 inode 不变）
  cp "$release/deploy/docker-compose.yml" "$APP_DIR/docker-compose.yml"
  cp "$release/deploy/Caddyfile" "$APP_DIR/Caddyfile"
  cp "$release/deploy/remote.sh" "$APP_DIR/remote.sh" # 供 status / rollback 等命令使用
  rm -rf "$APP_DIR/db"; cp -r "$release/db" "$APP_DIR/db"

  local prev
  prev="$(current_tag)"
  # 先保持当前版本号，只启动数据库，不动正在运行的应用
  write_compose_env "${prev:-$tag}"
  log "启动数据库 ..."
  start_db

  backup_db "pre-$tag"

  # 迁移表结构（只新增，不会删除已有数据）
  migrate

  # 数据库为空：首次安装导入种子数据；从 JSON 版本升级则导入线上 db.json
  local json_sync=false
  if [ "$(psql_db -c "SELECT count(*) FROM settings")" = 0 ]; then
    if [ -f "$APP_DIR/data/db.json" ]; then
      log "检测到旧版 JSON 数据，迁移到 PostgreSQL ..."
      backup_json "pre-pg-migration"
      migrate --import "$APP_DIR/data/db.json"
      json_sync=true
    else
      migrate --import "$APP_DIR/db/seed.json"
    fi
  fi

  local site_url
  site_url="$(env_get NEXT_PUBLIC_SITE_URL)"
  log "构建镜像 $IMAGE_NAME:$tag（站点地址 ${site_url:-未设置}）..."
  # 构建期间旧容器照常运行；构建失败直接退出，线上不受影响
  BUILD_DATABASE_URL="postgres://menhu:$(env_get PG_PASSWORD)@127.0.0.1:${DB_PORT}/menhu" \
  docker build \
      --network host \
      --secret id=database_url,env=BUILD_DATABASE_URL \
      --build-arg "NEXT_PUBLIC_SITE_URL=${site_url}" \
      --build-arg "NPM_REGISTRY=${NPM_REGISTRY}" \
      -t "$IMAGE_NAME:$tag" "$release" \
    || die "镜像构建失败，线上服务未做任何改动"

  if $json_sync; then
    # 构建期间旧版本可能仍有写入（阅读数、后台编辑）：停掉旧服务后完整同步一次
    log "停止旧版本并做最终数据同步 ..."
    compose stop app >/dev/null 2>&1 || true
    backup_json "final-sync"
    if ! migrate --import "$APP_DIR/data/db.json" --replace; then
      compose start app >/dev/null 2>&1 || true # 恢复旧版本服务
      die "最终数据同步失败，已恢复旧版本运行"
    fi
  fi

  log "切换到新版本 $tag（约几秒中断）..."
  switch_to "$tag"

  if wait_healthy; then
    [ -n "$prev" ] && [ "$prev" != "$tag" ] && echo "$prev" > "$APP_DIR/.previous_tag"
    echo "$tag" > "$APP_DIR/.current_tag"
    reload_caddy
    cleanup
    log "部署成功：$tag"
    compose ps
  else
    warn "新版本健康检查失败，最近日志："
    compose logs --tail 50 app || true
    if [ -n "$prev" ] && docker image inspect "$IMAGE_NAME:$prev" >/dev/null 2>&1; then
      warn "自动回滚到 $prev ..."
      switch_to "$prev"
      wait_healthy && log "已回滚到 $prev" || warn "回滚后仍不健康，请检查：docker compose logs app"
    else
      write_compose_env "${prev:-$tag}"
    fi
    die "部署失败：$tag"
  fi
}

cmd_rollback() {
  local prev cur
  prev="$(previous_tag)"; cur="$(current_tag)"
  [ -n "$prev" ] || die "没有可回滚的上一个版本"
  docker image inspect "$IMAGE_NAME:$prev" >/dev/null 2>&1 || die "镜像 $IMAGE_NAME:$prev 已不存在"
  backup_db "pre-rollback"
  log "回滚：$cur → $prev（注意：只回滚程序，数据库保持当前状态）"
  switch_to "$prev"
  wait_healthy || die "回滚后健康检查失败"
  echo "$prev" > "$APP_DIR/.current_tag"
  echo "$cur" > "$APP_DIR/.previous_tag"
  log "回滚完成（再次执行 rollback 可切回 $cur）"
}

cmd_status() {
  echo "当前版本：$(current_tag)"
  echo "上一版本：$(previous_tag)"
  compose ps
  if db_has_schema; then
    echo; echo "数据库：$(psql_db -c "SELECT format('%s 个频道，%s 篇文章，库大小 %s', (SELECT count(*) FROM channels), (SELECT count(*) FROM articles), pg_size_pretty(pg_database_size('menhu')))")"
  fi
  echo; echo "最近备份："
  ls -1t "$APP_DIR"/backups/ 2>/dev/null | head -n 5 || true
}

case "${1:-}" in
  deploy)   shift; cmd_deploy "$@" ;;
  rollback) cmd_rollback ;;
  backup)   backup_db manual ;;
  status)   cmd_status ;;
  logs)     compose logs --tail "${2:-200}" -f app ;;
  *) echo "用法：remote.sh deploy <tag> <src> | rollback | backup | status | logs [n]"; exit 1 ;;
esac
