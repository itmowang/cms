#!/usr/bin/env bash
# =============================================================================
# 数据库迁移 / 初始化（服务器和本地开发共用）
# 通过 docker compose 在 db 容器里执行 psql，不需要本机安装 PostgreSQL 客户端。
#
# 用法：
#   bash db/migrate.sh [--import <json>] [--replace] -- <docker compose 参数...>
#
#   --import <json>  数据库为空时导入该 JSON（旧版 db.json 或 db/seed.json）
#   --replace        清空后重新导入（仅用于 JSON → PostgreSQL 切换时的最终同步）
#
# 例：bash db/migrate.sh --import db/seed.json -- -f db/docker-compose.dev.yml
# =============================================================================
set -Eeuo pipefail
export MSYS_NO_PATHCONV=1 # Windows Git Bash 下不要改写容器内路径

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMPORT="" REPLACE=false
while [ $# -gt 0 ]; do
  case "$1" in
    --import)  IMPORT="${2:?--import 需要文件路径}"; shift 2 ;;
    --replace) REPLACE=true; shift ;;
    --)        shift; break ;;
    *)         echo "未知参数：$1" >&2; exit 1 ;;
  esac
done
COMPOSE=(docker compose "$@")
PGUSER="${PGUSER:-menhu}" PGDATABASE="${PGDATABASE:-menhu}"

log() { printf '\033[1;32m[db]\033[0m %s\n' "$*"; }
psql_db() { "${COMPOSE[@]}" exec -T db psql -X -q -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$PGDATABASE" "$@"; }

# 1. 等待数据库就绪
for i in $(seq 1 60); do
  "${COMPOSE[@]}" exec -T db pg_isready -q -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1 && break
  [ "$i" -eq 60 ] && { echo "数据库 60 秒内未就绪" >&2; exit 1; }
  sleep 1
done

# 2. 按顺序执行未执行过的迁移（每个文件一个事务）
psql_db -c "SET client_min_messages = warning; CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
for f in "$DIR"/migrations/*.sql; do
  v="$(basename "$f" .sql)"
  [[ "$v" =~ ^[0-9A-Za-z_-]+$ ]] || { echo "非法迁移文件名：$v" >&2; exit 1; }
  [ "$(psql_db -tA -c "SELECT 1 FROM schema_migrations WHERE version = '$v'")" = 1 ] && continue
  log "执行迁移 $v"
  { tr -d '\r' < "$f"; printf "\nINSERT INTO schema_migrations (version) VALUES ('%s');\n" "$v"; } \
    | psql_db --single-transaction -f -
done

# 3. 导入 JSON 数据
if [ -n "$IMPORT" ]; then
  [ -f "$IMPORT" ] || { echo "导入文件不存在：$IMPORT" >&2; exit 1; }
  if ! $REPLACE && [ "$(psql_db -tA -c "SELECT count(*) FROM settings")" != 0 ]; then
    log "数据库已有数据，跳过导入"
  else
    log "导入 $IMPORT（replace=$REPLACE）"
    "${COMPOSE[@]}" exec -T db sh -c 'cat > /tmp/menhu-import.json' < "$IMPORT"
    psql_db -tA -v replace="$REPLACE" <<'SQL'
\set doc `cat /tmp/menhu-import.json`
SELECT import_menhu_json(:'doc'::jsonb, :'replace'::boolean);
SQL
    "${COMPOSE[@]}" exec -T db rm -f /tmp/menhu-import.json
  fi
fi
log "数据库已是最新"
