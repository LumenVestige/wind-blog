#!/bin/sh
# 在服务器 /root 执行：~/upgrade-wind-blog.sh
# 从阿里云杭州镜像仓库拉取新版本，升级两个实例，删除本机旧的 wind-blog 镜像。
# 首次使用前登录一次：
#   docker login --username=sanenchen registry.cn-hangzhou.aliyuncs.com
set -eu

REGISTRY="${REGISTRY:-registry.cn-hangzhou.aliyuncs.com/sanenchen/wind-blog}"
TAG="${1:-latest}"
ROOT="${BLOG_ROOT:-/root/blog}"
IMAGE="$REGISTRY:$TAG"
LOCK="/tmp/upgrade-wind-blog.lock"
previous=""

restore() {
  if [ -n "$previous" ]; then
    echo "部署中断，恢复 $previous" >&2
    tmp="$(mktemp)"
    sed "s|^WIND_BLOG_IMAGE=.*|WIND_BLOG_IMAGE=$previous|" "$ROOT/.env" > "$tmp"
    mv "$tmp" "$ROOT/.env"
    docker compose -f "$ROOT/compose.yaml" --project-directory "$ROOT" up -d || true
  fi
}

trap 'if [ "$cancelled" = 1 ]; then restore; fi; rm -f "$LOCK"' EXIT
trap 'cancelled=1; echo "收到中断，停止部署" >&2; exit 130' INT TERM HUP
cancelled=0

cd "$ROOT"
previous="$(grep -E '^WIND_BLOG_IMAGE=' .env | cut -d= -f2- || true)"
if [ -f "$LOCK" ] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then
  echo "停止上一次部署 $(cat "$LOCK")"
  kill -TERM "$(cat "$LOCK")" 2>/dev/null || true
  sleep 1
  kill -KILL "$(cat "$LOCK")" 2>/dev/null || true
fi
echo $$ > "$LOCK"

echo "拉取 $IMAGE"
docker pull "$IMAGE"

tmp="$(mktemp)"
sed "s|^WIND_BLOG_IMAGE=.*|WIND_BLOG_IMAGE=$IMAGE|" .env > "$tmp"
mv "$tmp" .env

echo "升级实例"
if [ "$cancelled" = 1 ] || ! docker compose up -d; then
  echo "升级失败，恢复 $previous" >&2
  if [ -n "$previous" ]; then
    tmp="$(mktemp)"
    sed "s|^WIND_BLOG_IMAGE=.*|WIND_BLOG_IMAGE=$previous|" .env > "$tmp"
    mv "$tmp" .env
    docker compose up -d || true
  fi
  exit 1
fi

echo "删除旧镜像"
docker images --format '{{.Repository}}:{{.Tag}}' \
  | grep -E '^(registry(-vpc)?\.cn-hangzhou\.aliyuncs\.com/sanenchen/wind-blog|wind-blog):' \
  | grep -vx "$IMAGE" \
  | xargs -r docker image rm || true
docker image prune -f >/dev/null

docker ps --filter name=wind-blog --format '{{.Names}} {{.Image}} {{.Status}}'
