#!/usr/bin/env bash
# jxc-update.sh —— 飞牛 NAS 进销存一键更新
#
# 用法：
#   bash jxc-update.sh history/jxc_patch6b_20261109.tgz --expect-sha bf64ebbf...
#   bash jxc-update.sh --auto                 # 自动取 history 里最新未应用过的包
#   bash jxc-update.sh <包> --dry-run         # 只核对与比对，不动文件、不构建
#   bash jxc-update.sh <包> --assert "/app/dist/server/modules/system/sys-log.interceptor.js|路径=|1"
#
# 做的事：校验哈希 → 备份被覆盖文件 → 解包到暂存区 → 逐文件比对 → 覆盖 →
#         docker compose build（失败自动回滚源码）→ 镜像内断言 → up -d →
#         等 HTTP 200 → 查 ERROR 日志 → 记 applied.log
#
# 环境变量：JXC_ROOT（默认 /vol1/1000/jxc）、JXC_IMAGE（默认 jxc-app:latest）

set -uo pipefail

ROOT="${JXC_ROOT:-/vol1/1000/jxc}"
HIST="$ROOT/history"
LOG="$HIST/applied.log"
IMAGE="${JXC_IMAGE:-jxc-app:latest}"
TS="$(date +%Y%m%d_%H%M%S)"

PKG=""
EXPECT_SHA=""
DRY=0
AUTO=0
ASSERTS=()

say()  { printf '\n== %s ==\n' "$*"; }
ok()   { printf '  [OK]   %s\n' "$*"; }
bad()  { printf '  [FAIL] %s\n' "$*"; }
warn() { printf '  [WARN] %s\n' "$*"; }
die()  { bad "$*"; printf '\n更新已中止，业务未受影响。\n'; exit 1; }

usage() {
  sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

while [ $# -gt 0 ]; do
  case "$1" in
    --expect-sha) EXPECT_SHA="${2:-}"; shift 2 ;;
    --assert)     ASSERTS+=("${2:-}"); shift 2 ;;
    --dry-run)    DRY=1; shift ;;
    --auto)       AUTO=1; shift ;;
    -h|--help)    usage ;;
    -*)           die "未知参数：$1" ;;
    *)            PKG="$1"; shift ;;
  esac
done

# ---------- 0. 环境预检 ----------
say "0. 环境预检"
[ -d "$ROOT" ] || die "项目目录不存在：$ROOT"

if [ -f "$ROOT/docker-compose.yml" ]; then
  COMPOSE="$ROOT/docker-compose.yml"
elif [ -f "$ROOT/compose.yml" ]; then
  COMPOSE="$ROOT/compose.yml"
elif [ -f "$ROOT/docker-compose.yaml" ]; then
  COMPOSE="$ROOT/docker-compose.yaml"
else
  die "找不到 compose 文件（docker-compose.yml / compose.yml）"
fi
ok "compose：$COMPOSE"

if command -v docker >/dev/null 2>&1; then
  ok "docker：$(docker --version | head -n1)"
else
  die "docker 命令不可用（当前用户是否在 docker 组？）"
fi

compose() { docker compose -f "$COMPOSE" --project-directory "$ROOT" "$@"; }
df -h "$ROOT" | tail -n1 | awk '{print "  磁盘可用： "$4}'

# ---------- 1. 选包 ----------
say "1. 定位补丁包"
mkdir -p "$HIST"

if [ -z "$PKG" ] && [ "$AUTO" = 1 ]; then
  found=0
  for f in $(ls -1t "$HIST"/jxc_patch*.tgz 2>/dev/null); do
    sha="$(sha256sum "$f" | awk '{print $1}')"
    if grep -q "$sha" "$LOG" 2>/dev/null; then continue; fi
    age=$(( $(date +%s) - $(stat -c %Y "$f") ))
    if [ "$age" -lt 120 ]; then die "包刚传上来不到 2 分钟（可能还没传完）：$f"; fi
    PKG="$f"; EXPECT_SHA="$sha"; found=1; break
  done
  [ "$found" = 1 ] || die "history 里没有未应用过的 jxc_patch*.tgz"
  ok "自动选中最新的未应用包：$PKG"
fi

[ -n "$PKG" ] || die "没给包路径。用法：bash jxc-update.sh history/xxx.tgz"
# 允许相对路径（history/xxx.tgz）或只给文件名，统一按项目根解析
if [ ! -f "$PKG" ]; then
  if [ -f "$ROOT/$PKG" ]; then
    PKG="$ROOT/$PKG"
  elif [ -f "$HIST/$PKG" ]; then
    PKG="$HIST/$PKG"
  fi
fi
[ -f "$PKG" ] || die "包不存在：$PKG（没写路径的话，脚本会在 $ROOT 和 $HIST 下找）"

PKG_SHA="$(sha256sum "$PKG" | awk '{print $1}')"
printf '  文件：%s\n  大小：%s 字节\n  SHA256：%s\n' "$PKG" "$(stat -c %s "$PKG")" "$PKG_SHA"
if [ -n "$EXPECT_SHA" ]; then
  [ "$PKG_SHA" = "$EXPECT_SHA" ] || die "哈希不符：期望 $EXPECT_SHA"
  ok "哈希与期望一致"
fi

if grep -q "$PKG_SHA" "$LOG" 2>/dev/null; then
  warn "这个包（同哈希）之前已经应用过，继续会重复构建"
fi

# ---------- 2. 包内容合法性 ----------
say "2. 包内容检查"
ENTRIES="$(tar -tzf "$PKG")"
[ -n "$ENTRIES" ] || die "包是空的"
N="$(printf '%s\n' "$ENTRIES" | wc -l | tr -d ' ')"
printf '  条目数：%s\n' "$N"
printf '%s\n' "$ENTRIES" | sed 's/^/    /'

while IFS= read -r e; do
  case "$e" in
    /*)  die "包里有绝对路径：$e" ;;
    *..*) die "包里有 .. 路径：$e" ;;
  esac
done <<< "$ENTRIES"

# ---------- 3. 备份将被覆盖的文件 ----------
say "3. 备份现有文件"
EXIST=()
ADD=()
while IFS= read -r e; do
  if [ -e "$ROOT/$e" ]; then EXIST+=("$e"); else ADD+=("$e"); fi
done <<< "$ENTRIES"

BAK=""
if [ ${#EXIST[@]} -gt 0 ]; then
  if [ "$DRY" = 1 ]; then
    warn "dry-run 不建备份（正式执行时才备份）"
  else
    BAK="$HIST/backup_${TS}.tgz"
    tar -czf "$BAK" -C "$ROOT" "${EXIST[@]}" || die "备份失败"
    bcnt="$(tar -tzf "$BAK" | wc -l | tr -d ' ')"
    [ "$bcnt" = "${#EXIST[@]}" ] || die "备份条目数不符（$bcnt vs ${#EXIST[@]}）"
    chmod 644 "$BAK"
    ok "备份 ${#EXIST[@]} 个文件 → $BAK"
  fi
else
  warn "包内文件在项目里都不存在，无需备份（首次新增）"
fi
[ ${#ADD[@]} -gt 0 ] && warn "包内新增文件：${ADD[*]}"

# ---------- 4. 暂存 + 逐文件比对 ----------
say "4. 解包比对（不改动项目文件）"
STAGE="$HIST/stage_${TS}"
rm -rf "$STAGE" 2>/dev/null || true
mkdir -p "$STAGE"
tar -xzf "$PKG" -C "$STAGE" || die "解包失败"

# 平台专属依赖闸门：自托管环境没有 @lark-apaas/* 这套包，带进来的文件构建必挂
BADDEP=()
for e in "${EXIST[@]}" "${ADD[@]}"; do
  if grep -q '@lark-apaas/' "$STAGE/$e" 2>/dev/null; then BADDEP+=("$e"); fi
done
if [ ${#BADDEP[@]} -gt 0 ]; then
  bad "包内文件用了平台专属 import，NAS 上没有这套包，docker build 必失败："
  for f in "${BADDEP[@]}"; do
    printf '        %s\n' "$f"
    grep -n '@lark-apaas/' "$STAGE/$f" 2>/dev/null | head -3 | sed 's/^/          /'
  done
  rm -rf "$STAGE" 2>/dev/null || true
  die "未覆盖任何文件。改成本地等价写法（antd / @/lib/confirm）后重新打包"
fi

CHANGED=0; SAME=0
for e in "${EXIST[@]}"; do
  if cmp -s "$STAGE/$e" "$ROOT/$e"; then
    SAME=$((SAME+1)); printf '    相同  %s\n' "$e"
  else
    CHANGED=$((CHANGED+1)); printf '    变更  %s\n' "$e"
    diff -u --strip-trailing-cr "$ROOT/$e" "$STAGE/$e" 2>/dev/null | sed -n '3,40p' | sed 's/^/        /'
  fi
done
printf '  汇总：变更 %s 个，相同 %s 个，新增 %s 个\n' "$CHANGED" "$SAME" "${#ADD[@]}"

if [ "$DRY" = 1 ]; then
  say "dry-run 结束"
  printf '  未覆盖任何文件，未构建镜像，未重启容器。\n  去掉 --dry-run 即为正式执行。\n'
  rm -rf "$STAGE" 2>/dev/null || true
  exit 0
fi

if [ "$CHANGED" = 0 ] && [ ${#ADD[@]} = 0 ]; then
  say "无需更新"
  printf '  包内文件与项目现有文件完全一致，跳过构建与重启。\n'
  printf '%s  %s  files=0 changed=0  image=unchanged  NOOP\n' \
    "$(date '+%F %T')" "$(basename "$PKG")" >> "$LOG"
  rm -rf "$STAGE" 2>/dev/null || true
  exit 0
fi

# ---------- 5. 覆盖 ----------
say "5. 覆盖源文件"
for e in "${EXIST[@]}" "${ADD[@]}"; do
  mkdir -p "$(dirname "$ROOT/$e")"
  cp -p "$STAGE/$e" "$ROOT/$e" || die "覆盖失败：$e"
done
for e in "${EXIST[@]}" "${ADD[@]}"; do
  a="$(sha256sum "$STAGE/$e" | awk '{print $1}')"
  b="$(sha256sum "$ROOT/$e" | awk '{print $1}')"
  [ "$a" = "$b" ] || die "覆盖后哈希不一致：$e"
done
ok "覆盖完成，逐文件哈希校验通过"

restore() {
  if [ -n "$BAK" ] && [ -f "$BAK" ]; then
    tar -xzf "$BAK" -C "$ROOT" && printf '  已从 %s 回滚源码\n' "$BAK"
  fi
}

# ---------- 6. 构建 ----------
say "6. 重建镜像（前端约 2 分钟，别中断）"
BUILD_LOG="$HIST/build_${TS}.log"
compose build 2>&1 | tee "$BUILD_LOG"
rc=${PIPESTATUS[0]}
[ "$rc" = 0 ] || { restore; die "docker compose build 失败（退出码 $rc），已回滚源码，镜像未替换"; }
grep -q 'ERROR' "$BUILD_LOG" && warn "构建日志里出现 ERROR 字样，请复核：$BUILD_LOG"
ok "构建成功（日志：$BUILD_LOG）"

# ---------- 7. 镜像内断言 ----------
say "7. 镜像内断言"
if [ ${#ASSERTS[@]} -gt 0 ]; then
  for a in "${ASSERTS[@]}"; do
    apath="$(printf '%s' "$a" | cut -d'|' -f1)"
    apat="$(printf '%s' "$a" | cut -d'|' -f2)"
    awant="$(printf '%s' "$a" | cut -d'|' -f3)"; awant="${awant:-1}"
    got="$(docker run --rm --entrypoint sh "$IMAGE" -c "grep -o '$apat' $apath 2>/dev/null | wc -l" | tr -d ' \r\n')"
    if [ "$got" = "$awant" ]; then
      ok "$apath 中 '$apat' = $got（期望 $awant）"
    else
      bad "$apath 中 '$apat' = $got（期望 $awant）"
      restore
      die "镜像内容断言失败，已回滚源码"
    fi
  done
else
  warn "未提供 --assert，跳过内容断言（只会做通用检查）"
fi

docker run --rm --entrypoint sh "$IMAGE" -c "ls /app/dist/server/main.js >/dev/null && ls /app/dist/client/index.html >/dev/null" \
  && ok "镜像内 dist 结构完整" || { restore; die "镜像内 dist 缺文件"; }

# ---------- 8. 上线 ----------
say "8. 重启容器"
compose up -d || { die "compose up -d 失败（源码与镜像已就位，可手动排查）"; }
sleep 8

status_of() { docker inspect -f '{{.State.Status}}' "$1" 2>/dev/null || echo missing; }
app_status="$(status_of jxc-app)"
db_status="$(status_of jxc-db)"
printf '  jxc-app：%s    jxc-db：%s\n' "$app_status" "$db_status"
[ "$app_status" = "running" ] || { restore; die "jxc-app 未运行（$app_status）"; }
[ "$db_status" = "running" ] || warn "jxc-db 状态 $db_status"

# ---------- 9. HTTP 与日志检查 ----------
say "9. 服务可用性检查"
http_ok=0
if command -v curl >/dev/null 2>&1; then
  for i in $(seq 1 30); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:3000/ || true)"
    if [ "$code" = "200" ]; then http_ok=1; break; fi
    sleep 2
  done
else
  warn "宿主机没有 curl，跳过 HTTP 探活"
  http_ok=1
fi
[ "$http_ok" = 1 ] || { restore; die "60 秒内首页未返回 200"; }
[ "$http_ok" = 1 ] && ok "首页 HTTP 200"

errs="$(docker logs --tail 100 jxc-app 2>&1 | grep -c 'ERROR' || true)"
if [ "$errs" = 0 ]; then
  ok "最近 100 行日志无 ERROR"
else
  warn "最近日志有 $errs 行含 ERROR，如下（不影响继续，但要看一眼）"
  docker logs --tail 100 jxc-app 2>&1 | grep 'ERROR' | tail -n 5 | sed 's/^/        /'
fi
docker logs --tail 5 jxc-app 2>&1 | sed 's/^/        /'

# ---------- 10. 记账 ----------
if [ ${#EXIST[@]} -gt 0 ] || [ ${#ADD[@]} -gt 0 ]; then
  img_id="$(docker inspect -f '{{.Image}}' jxc-app 2>/dev/null | cut -c1-19)"
  printf '%s  %s  files=%s changed=%s  image=%s  OK\n' \
    "$(date '+%F %T')" "$(basename "$PKG")" "$(( ${#EXIST[@]} + ${#ADD[@]} ))" "$CHANGED" "$img_id" >> "$LOG"
fi
rm -rf "$STAGE" 2>/dev/null || true
ls -1t "$HIST"/backup_*.tgz 2>/dev/null | tail -n +6 | while read -r old; do rm -f "$old"; done

say "完成"
printf '  包：%s\n  变更文件：%s 个\n  备份：%s\n  已记入：%s\n' \
  "$(basename "$PKG")" "$CHANGED" "${BAK:-无}" "$LOG"
printf '  下一步：页面上按业务点一遍（送货单查看、审核、日志），有问题用\n'
printf '    tar -xzf %s -C %s && bash %s/jxc-update.sh --help\n' "${BAK:-<备份包>}" "$ROOT" "$ROOT"
