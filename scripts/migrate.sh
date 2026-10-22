#!/bin/sh
# Interactive front for scripts/migrate.ts.
# No arguments: ask for old/new site, account, and options.
# With arguments: forward them unchanged, for example
#   sh scripts/migrate.sh --old-url https://old --old-username a --old-password p --new-url http://localhost:3000
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

if [ "$#" -gt 0 ]; then
  exec npx tsx scripts/migrate.ts "$@"
fi

restore_echo() {
  stty echo 2>/dev/null || true
}
trap restore_echo EXIT INT TERM

# Prompts go to stderr so the answer can be captured with $(...).
ask() {
  _prompt=$1
  _default=${2-}
  while :; do
    if [ -n "$_default" ]; then
      printf '%s [%s]: ' "$_prompt" "$_default" >&2
    else
      printf '%s: ' "$_prompt" >&2
    fi
    IFS= read -r _input || exit 1
    if [ -z "$_input" ]; then
      _input=$_default
    fi
    if [ -n "$_input" ]; then
      printf '%s' "$_input"
      return
    fi
    printf '这项不能空。\n' >&2
  done
}

ask_secret() {
  _prompt=$1
  _allow_empty=${2-}
  while :; do
    printf '%s: ' "$_prompt" >&2
    stty -echo 2>/dev/null || true
    IFS= read -r _input || {
      restore_echo
      exit 1
    }
    restore_echo
    printf '\n' >&2
    if [ -n "$_input" ] || [ "$_allow_empty" = allow-empty ]; then
      printf '%s' "$_input"
      return
    fi
    printf '这项不能空。\n' >&2
  done
}

ask_yes() {
  _prompt=$1
  _default=$2
  if [ "$_default" = y ]; then
    _hint=Y/n
  else
    _hint=y/N
  fi
  printf '%s [%s]: ' "$_prompt" "$_hint" >&2
  IFS= read -r _input || exit 1
  case $_input in
    [Yy]|[Yy][Ee][Ss]) printf y ;;
    [Nn]|[Nn][Oo]) printf n ;;
    *) printf '%s' "$_default" ;;
  esac
}

printf '=== Wind Blog 迁移 ===\n'
printf '直接回车使用方括号里的默认值。密码输入不回显。\n\n'

OLD_URL=$(ask '旧站地址')
OLD_USER=$(ask '旧站用户名')
OLD_PASS=$(ask_secret '旧站密码')

NEW_URL=$(ask '新站地址' 'http://localhost:3000')
NEW_USER=$(ask '新站用户名' "$OLD_USER")
NEW_PASS=$(ask_secret '新站密码（回车则与旧站相同）' allow-empty)
if [ -z "$NEW_PASS" ]; then
  NEW_PASS=$OLD_PASS
fi

NEW_REGISTER=$(ask_yes '新站还没初始化，用这组账号自动开通？' n)

printf '密码文章怎么处理？\n' >&2
printf '  1) 改成私密（默认，拿不到原密码）\n' >&2
printf '  2) 跳过\n' >&2
printf '  3) 保持密码保护（没有原密码，读者打不开）\n' >&2
printf '请选择 [1]: ' >&2
IFS= read -r PW_CHOICE || exit 1
case ${PW_CHOICE:-1} in
  2|skip) PW_MODE=skip ;;
  3|keep) PW_MODE=keep ;;
  *) PW_MODE=private ;;
esac

INCLUDE_COMMENTS=$(ask_yes '一并迁移顶层评论？' n)

printf '改写图片域名（旧域名=新域名，回车跳过）: ' >&2
IFS= read -r REWRITE || exit 1

DRY_RUN=$(ask_yes '只预览，不写入？' n)

printf '\n将从 %s（%s）迁到 %s（%s）\n' "$OLD_URL" "$OLD_USER" "$NEW_URL" "$NEW_USER"
printf '密码文章：%s；评论：%s；预览：%s\n' "$PW_MODE" "$INCLUDE_COMMENTS" "$DRY_RUN"
CONFIRM=$(ask_yes '开始迁移？' y)
if [ "$CONFIRM" != y ]; then
  printf '已取消。\n'
  exit 0
fi

set -- \
  --old-url "$OLD_URL" \
  --old-username "$OLD_USER" \
  --old-password "$OLD_PASS" \
  --new-url "$NEW_URL" \
  --new-username "$NEW_USER" \
  --new-password "$NEW_PASS" \
  --password-articles "$PW_MODE"

if [ "$NEW_REGISTER" = y ]; then
  set -- "$@" --new-register
fi
if [ "$INCLUDE_COMMENTS" = y ]; then
  set -- "$@" --include-comments
fi
if [ -n "$REWRITE" ]; then
  set -- "$@" --rewrite-domain "$REWRITE"
fi
if [ "$DRY_RUN" = y ]; then
  set -- "$@" --dry-run
fi

exec npx tsx scripts/migrate.ts "$@"
