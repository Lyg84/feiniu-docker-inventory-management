#!/bin/bash
# 同步 electron-hiprint 官方最新发行版到本机 downloads 目录
# 页面「下载打印插件」按钮直接下载本机这份文件，不再依赖 gitee 的临时 token 直链
set -uo pipefail

ROOT=/vol1/1000/jxc
DIR=$ROOT/downloads
API=https://gitee.com/api/v5/repos/CcSimple/electron-hiprint/releases/latest
PAGE=https://gitee.com/CcSimple/electron-hiprint/releases
LOG=$ROOT/history/hiprint_sync.log

mkdir -p "$DIR" "$ROOT/history"
say() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG" >/dev/null; }

json=$(curl -s -m 40 "$API")
if [ -z "${json:-}" ]; then say "拉取发布信息失败，退出"; exit 1; fi

tag=$(printf '%s' "$json" | jq -r '.tag_name // empty')
name=$(printf '%s' "$json" | jq -r '.assets[]? | select(.name | test("win_x64")) | .name' | head -1)
url=$(printf '%s' "$json" | jq -r '.assets[]? | select(.name | test("win_x64")) | .browser_download_url' | head -1)

if [ -z "$tag" ] || [ -z "$name" ] || [ -z "$url" ]; then
  say "发布信息解析失败 tag=$tag name=$name"
  exit 1
fi

meta=$DIR/hiprint.json
have=""
if [ -f "$meta" ]; then have=$(jq -r '.version // empty' "$meta" 2>/dev/null); fi

if [ "$have" = "$tag" ] && [ -f "$DIR/$name" ]; then
  size=$(stat -c%s "$DIR/$name")
  sha=$(sha256sum "$DIR/$name" | awk '{print $1}')
  cat > "$meta" <<EOF
{
  "version": "$tag",
  "fileName": "$name",
  "size": $size,
  "sha256": "$sha",
  "syncedAt": "$(date '+%F %T')",
  "upstreamUrl": "$PAGE"
}
EOF
  say "已是最新版本 $tag，跳过下载（$((size/1048576))MB）"
  exit 0
fi

say "发现版本 $tag，开始下载 $name"
tmp=$DIR/$name.part
rm -f "$tmp"
curl -L -m 1800 --retry 2 --retry-delay 5 -o "$tmp" "$url"
rc=$?
if [ $rc -ne 0 ]; then
  say "下载失败（curl 退出码 $rc），保留原文件"
  rm -f "$tmp"
  exit 1
fi

size=$(stat -c%s "$tmp" 2>/dev/null || echo 0)
if [ "$size" -lt 10000000 ]; then
  say "下载包异常（$size 字节），放弃"
  rm -f "$tmp"
  exit 1
fi

mv -f "$tmp" "$DIR/$name"
sha=$(sha256sum "$DIR/$name" | awk '{print $1}')
find "$DIR" -maxdepth 1 -name 'hiprint_win_x64-*.exe' ! -name "$name" -delete

cat > "$meta" <<EOF
{
  "version": "$tag",
  "fileName": "$name",
  "size": $size,
  "sha256": "$sha",
  "syncedAt": "$(date '+%F %T')",
  "upstreamUrl": "$PAGE"
}
EOF
say "同步完成：$tag（$((size/1048576))MB，sha256 ${sha:0:16}…）"
