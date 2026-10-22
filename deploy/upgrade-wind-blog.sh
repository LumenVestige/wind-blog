#!/bin/sh
# 在服务器 /root 执行：~/upgrade-wind-blog.sh
# 从阿里云杭州镜像仓库拉取新版本，升级两个实例，删除本机旧的 wind-blog 镜像。
# 首次使用前登录一次：
#   docker login --username=sanenchen registry-vpc.cn-hangzhou.aliyuncs.com
set -eu

REGISTRY="${REGISTRY:-registry-vpc.cn-hangzhou.aliyuncs.com/sanenchen/wind-blog}"
TAG="${1:-latest}"
ROOT="${BLOG_ROOT:-/root/blog}"
IMAGE="$REGISTRY:$TAG"

cd "$ROOT"
previous="$(grep -E '^WIND_BLOG_IMAGE=' .env | cut -d= -f2- || true)"

echo "拉取 $IMAGE"
docker pull "$IMAGE"

tmp="$(mktemp)"
sed "s|^WIND_BLOG_IMAGE=.*|WIND_BLOG_IMAGE=$IMAGE|" .env > "$tmp"
mv "$tmp" .env

echo "升级实例"
if ! docker compose up -d; then
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
