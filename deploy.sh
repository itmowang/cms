#!/usr/bin/env bash
# =============================================================================
# menhu-cms 一键部署（在本地 Git Bash / macOS / Linux 终端执行）
#
#   ./deploy.sh              打包当前代码 → 上传 → 服务器构建镜像 → 健康检查 → 切换
#   ./deploy.sh setup-key    生成并上传 SSH 公钥（之后部署免密码）
#   ./deploy.sh status       查看线上版本、容器状态、最近备份
#   ./deploy.sh logs [n]     实时查看应用日志
#   ./deploy.sh backup       立即备份线上数据
#   ./deploy.sh pull-backup  把服务器最新备份下载到本地 ./backups
#   ./deploy.sh rollback     回滚到上一个版本（再执行一次可切回）
#   ./deploy.sh ssh          登录服务器
#
# 配置：可在 deploy/deploy.local.env 中覆盖下面的变量（该文件不提交 git）
# =============================================================================
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
[ -f deploy/deploy.local.env ] && . deploy/deploy.local.env

DEPLOY_HOST="${DEPLOY_HOST:-43.110.24.203}"
DEPLOY_USER="${DEPLOY_USER:-root}"   # 腾讯云 Ubuntu 默认用户通常是 ubuntu
DEPLOY_PORT="${DEPLOY_PORT:-22}"
APP_DIR="${APP_DIR:-/opt/menhu-cms}"
# 国内服务器可改为 https://registry.npmmirror.com
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org}"
# Docker Hub 镜像加速地址（国内服务器拉不到镜像时填写），仅首次安装 Docker 时写入
DOCKER_MIRROR="${DOCKER_MIRROR:-}"
KEEP_BACKUPS="${KEEP_BACKUPS:-30}"

TARGET="$DEPLOY_USER@$DEPLOY_HOST"
SSH_OPTS=(-p "$DEPLOY_PORT" -o ServerAliveInterval=30 -o StrictHostKeyChecking=accept-new)
SUDO=""; [ "$DEPLOY_USER" = "root" ] || SUDO="sudo -n"

log() { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[错误]\033[0m %s\n' "$*" >&2; exit 1; }

remote() { ssh "${SSH_OPTS[@]}" "$TARGET" "$@"; }

# 拼出带环境变量的远程命令（值经过 printf %q 转义，防止注入）
remote_env() {
  printf 'env APP_DIR=%q NPM_REGISTRY=%q DOCKER_MIRROR=%q KEEP_BACKUPS=%q DEFAULT_SITE_URL=%q' \
    "$APP_DIR" "$NPM_REGISTRY" "$DOCKER_MIRROR" "$KEEP_BACKUPS" "http://$DEPLOY_HOST"
}

remote_cmd() {
  local -a extra=()
  [ "$1" = "logs" ] && extra=(-t) # 日志需要 tty 才能 Ctrl+C 退出
  ssh "${SSH_OPTS[@]}" "${extra[@]}" "$TARGET" \
    "$SUDO $(remote_env) bash $(printf '%q' "$APP_DIR/remote.sh") $(printf '%q ' "$@")"
}

cmd_deploy() {
  command -v tar >/dev/null || die "本地缺少 tar"
  local sha dirty="" tag tmp
  sha="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
  if git rev-parse --git-dir >/dev/null 2>&1 && [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    dirty="-dirty"
    log "注意：工作区有未提交的改动，将按当前文件部署"
  fi
  tag="$(date +%Y%m%d%H%M%S)-${sha}${dirty}"
  tmp="/tmp/menhu-cms-upload-$tag"

  log "目标服务器：$TARGET:$DEPLOY_PORT  版本：$tag"
  log "打包并上传代码（不含 node_modules / .next / data / .env*）..."

  # 一次 SSH 连接完成上传 + 部署；本地数据和密钥文件不会上传
  tar -czf - \
    --exclude=node_modules \
    --exclude=./.git \
    --exclude=./.next \
    --exclude=./.kiro \
    --exclude=./data \
    --exclude=./backups \
    --exclude=./.tmp-test \
    --exclude='./.env*' \
    --exclude='*.tsbuildinfo' \
    --exclude=./deploy/deploy.local.env \
    . \
  | remote "set -e
      rm -rf $(printf '%q' "$tmp") && mkdir -p $(printf '%q' "$tmp")
      tar -xzf - -C $(printf '%q' "$tmp")
      sed -i 's/\r\$//' $(printf '%q' "$tmp")/deploy/*.sh $(printf '%q' "$tmp")/deploy/Caddyfile $(printf '%q' "$tmp")/db/*.sh
      $SUDO $(remote_env) bash $(printf '%q' "$tmp/deploy/remote.sh") deploy $(printf '%q %q' "$tag" "$tmp")"

  log "完成。访问：http://$DEPLOY_HOST"
}

cmd_setup_key() {
  local key="$HOME/.ssh/id_ed25519"
  if [ ! -f "$key" ]; then
    log "生成 SSH 密钥 $key"
    mkdir -p "$HOME/.ssh"
    ssh-keygen -t ed25519 -N "" -f "$key" -C "menhu-cms-deploy"
  fi
  log "上传公钥到 $TARGET（需要输入一次服务器密码）"
  remote 'umask 077; mkdir -p ~/.ssh; touch ~/.ssh/authorized_keys; k="$(cat)"; grep -qxF "$k" ~/.ssh/authorized_keys || echo "$k" >> ~/.ssh/authorized_keys' < "$key.pub"
  log "完成，之后部署无需密码"
}

cmd_pull_backup() {
  local name
  name="$(remote "$SUDO ls -1t $(printf '%q' "$APP_DIR/backups") | head -n 1")"
  [ -n "$name" ] || die "服务器上没有备份"
  mkdir -p backups
  remote "$SUDO cat $(printf '%q' "$APP_DIR/backups/$name")" > "backups/$name"
  log "已下载 backups/$name"
}

case "${1:-deploy}" in
  deploy)      cmd_deploy ;;
  setup-key)   cmd_setup_key ;;
  status)      remote_cmd status ;;
  logs)        remote_cmd logs "${2:-200}" ;;
  backup)      remote_cmd backup ;;
  rollback)    remote_cmd rollback ;;
  pull-backup) cmd_pull_backup ;;
  ssh)         ssh "${SSH_OPTS[@]}" -t "$TARGET" "cd $(printf '%q' "$APP_DIR") 2>/dev/null; exec bash -l" ;;
  -h|--help|help) sed -n '2,16p' "$0" ;;
  *) die "未知命令：$1（./deploy.sh help 查看用法）" ;;
esac
