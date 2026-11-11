#!/usr/bin/env bash
# jxc-restore.sh —— 进销存一键恢复（重装系统 / 换机 / 误删库之后用）
#
# 用法：
#   bash scripts/jxc-restore.sh /vol1/1000/jxc/backup/jxc_backup_20261110_1530.tgz
#   bash scripts/jxc-restore.sh <包> --yes          # 不问确认，直接执行
#   bash scripts/jxc-restore.sh <包> --rebuild      # 包里没有镜像，用源码重建（要联网）
#   bash scripts/jxc-restore.sh <包> --data-only     # 只恢复数据库，不动镜像/容器
#
# 做的事：校验包 → 还原部署文件 → 载入镜像（或重建）→ 起数据库 → pg_restore 覆盖 →
#         起应用 → 探活 → 核对表数量 → 打印结果。任一步失败即停，不往下滚。
#
# 环境变量：JXC_ROOT（默认 /vol1/1000/jxc）、JXC_IMAGE（默认 jxc-app:latest）

set -uo pipefail

ROOT="${JXC_ROOT:-/vol1/1000/jxc}"
IMAGE="${JXC_IMAGE:-jxc-app:latest}"
DB_CONT="${JXC_DB_CONTAINER:-jxc-db}"
TS="$(date +%Y%m%d_%H%M%S)"

PKG=""
ASSUME=0
REBUILD=0
DATA_ONLY=0

say() { printf '\n== %s ==\n' "$*"; }
ok()  { printf '  [OK]   %s\n' "$*"; }
bad() { printf '  [FAIL] %s\n' "$*"; }
warn(){ printf '  [WARN] %s\n' "$*"; }
die() { bad "$*"; printf '\n恢复已中止。\n'; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y)   ASSUME=1; shift ;;
    --rebuild)  REBUILD=1; shift ;;
    --data-only) DATA_ONLY=1; shift ;;
    -h|--help)  sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*)         die "未知参数：$1" ;;
    *)          PKG="$1"; shift ;;
  esac
done

[ -n "$PKG" ] || die "没给备份包。用法：bash scripts/jxc-restore.sh <备份包.tgz>"
[ -f "$PKG" ] || die "备份包不存在：$PKG"
PKG_SHA="$(sha256sum "$PKG" | awk '{print $1}')"

say "0. 预检"
if ! command -v docker >/dev/null 2>&1; then
  bad "本机没有 docker。飞牛 NAS 请先在「应用中心 → Docker」里安装并启动，再重跑本脚本。"
  exit 1
fi
ok "docker：$(docker --version | head -n1)"
printf '  包：%s\n  大小：%s 字节\n  SHA256：%s\n' "$PKG" "$(stat -c %s "$PKG")" "$PKG_SHA"

command -v pg_isready >/dev/null 2>&1 || true

say "1. 检查包内容"
ENTRIES="$(tar -tzf "$PKG" 2>/dev/null)"
[ -n "$ENTRIES" ] || die "包解不开或为空"
[ -f "$ROOT" ] && echo
TMPCHK="$(mktemp -d)"; trap 'rm -rf "$TMPCHK"' EXIT
tar -xzf "$PKG" -C "$TMPCHK" ./db.dump ./manifest.txt 2>/dev/null || die "包内缺少 db.dump / manifest.txt"
[ -s "$TMPCHK/db.dump" ] || die "包内 db.dump 为空"
ok "db.dump 存在（$(stat -c %s "$TMPCHK/db.dump") 字节）"
grep -E '表数量|应用镜像|备份时间' "$TMPCHK/manifest.txt" | sed 's/^/    /'

NEED_TABLES="$(grep '表数量' "$TMPCHK/manifest.txt" | grep -o '[0-9]\+' | head -n1)"
HAS_IMAGE=0
printf '%s\n' "$ENTRIES" | grep -q 'image/jxc-app.tar' && HAS_IMAGE=1
ok "包内镜像：$([ "$HAS_IMAGE" = 1 ] && echo 有 || echo 无)"

if [ "$DATA_ONLY" = 0 ] && [ "$HAS_IMAGE" = 0 ] && [ "$REBUILD" = 0 ]; then
  bad "包里没有应用镜像，且没加 --rebuild。"
  printf '        要么重新用默认参数备份一次（带镜像），要么把源码放回 %s 后加 --rebuild 重建。\n' "$ROOT"
  exit 1
fi

if [ "$ASSUME" = 0 ]; then
  printf '\n即将把 %s 里的数据库覆盖到 %s。\n' "$(basename "$PKG")" "$ROOT"
  printf '继续请输入 yes：'
  read -r ans
  [ "$ans" = "yes" ] || die "已取消（没输入 yes）"
fi

say "2. 还原部署文件"
mkdir -p "$ROOT"
if [ -d "$ROOT" ] && [ -f "$ROOT/docker-compose.yml" ] && [ "$DATA_ONLY" = 0 ]; then
  BK="$ROOT/history/pre-restore_${TS}.tgz"
  mkdir -p "$ROOT/history"
  tar -czf "$BK" -C "$ROOT" docker-compose.yml Dockerfile 2>/dev/null \
    && ok "现有部署文件已备份：$BK" || warn "现有部署文件备份失败（继续，但不影响数据）"
fi
tar -xzf "$PKG" -C "$TMPCHK" ./deploy 2>/dev/null || die "包内缺少 deploy/"
cp -a "$TMPCHK/deploy/." "$ROOT/" || die "部署文件写入失败（$ROOT 是否可写？）"
mkdir -p "$ROOT/backup" && chmod 777 "$ROOT/backup" 2>/dev/null || true
# 解包后目录可能带上来不可读的权限位（fnOS 走 ACL，容器里的 postgres 用户列不了 drizzle 目录），
# 统一放开：目录 755、文件 644，否则数据库容器会因读不到 /docker-entrypoint-initdb.d 反复重启
chmod -R a+rX "$ROOT/drizzle" "$ROOT/scripts" "$ROOT/Dockerfile" "$ROOT/docker-compose.yml" 2>/dev/null || true
ok "部署文件已写入 $ROOT"

say "3. 准备镜像"
if [ "$DATA_ONLY" = 0 ]; then
  if [ "$HAS_IMAGE" = 1 ]; then
    tar -xzf "$PKG" -C "$TMPCHK" ./image/jxc-app.tar || die "解不出镜像层"
    docker load -i "$TMPCHK/image/jxc-app.tar" | tail -n2 | sed 's/^/    /' || die "docker load 失败"
    docker tag "$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -m1 'jxc-app:latest')" "$IMAGE" 2>/dev/null || true
    ok "镜像已载入：$IMAGE"
  else
    [ -f "$ROOT/Dockerfile" ] || die "没有 Dockerfile，无法重建镜像"
    say "3b. 用源码重建镜像（需要联网拉依赖，约 2~3 分钟）"
    ( cd "$ROOT" && docker compose build ) || die "镜像重建失败"
    ok "镜像重建完成"
  fi
fi

say "4. 启动数据库"
mkdir -p "$ROOT/data/pg"
if [ ! -f "$ROOT/data/pg/PG_VERSION" ]; then
  # 全新系统上 ./data/pg 是 docker 以 root 建的空目录，容器内 postgres 用户写不进去，
  # 用一次性容器把属主改成 postgres（uid 70），initdb 才能正常初始化
  docker run --rm -u 0 -v "$ROOT/data/pg:/var/lib/postgresql/data" postgres:16-alpine \
    sh -c 'chown -R postgres:postgres /var/lib/postgresql/data' >/dev/null 2>&1 && ok "数据目录属主已调整为 postgres" \
    || warn "数据目录属主调整失败（若数据库起不来，见下方提示）"
fi
( cd "$ROOT" && docker compose up -d db ) || die "数据库容器启动失败"
ready=0
for i in $(seq 1 60); do
  if docker exec "$DB_CONT" pg_isready -U jxc -d jxc >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done
[ "$ready" = 1 ] || die "数据库 120 秒内没就绪，看日志：docker logs $DB_CONT（常见原因是 ./data/pg 属主不对，或 ./drizzle 权限不可读）"
ok "数据库就绪"

say "5. 恢复数据（pg_restore 覆盖当前库）"
mkdir -p "$ROOT/history"
RESTORE_LOG="$ROOT/history/restore_${TS}.log"
docker exec -i "$DB_CONT" pg_restore -U jxc -d jxc --clean --if-exists --no-owner --single-transaction \
  < "$TMPCHK/db.dump" 2> "$RESTORE_LOG"
rc=$?
if [ "$rc" != 0 ]; then
  bad "pg_restore 返回 $rc，看日志：$RESTORE_LOG"
  tail -n 8 "$RESTORE_LOG" | sed 's/^/    /'
  die "数据未恢复。库里仍是原来的内容（--single-transaction 已回滚）"
fi
if grep -qi 'error' "$RESTORE_LOG" 2>/dev/null; then
  warn "pg_restore 有告警（一般可忽略，逐条核对请查看 $RESTORE_LOG）"
fi
GOT_TABLES="$(docker exec "$DB_CONT" psql -U jxc -d jxc -t -A -c \
  "select count(*) from information_schema.tables where table_schema='public'" | tr -d ' \r\n')"
ok "数据已恢复，当前表数量：$GOT_TABLES"
if [ -n "${NEED_TABLES:-}" ] && [ "$GOT_TABLES" != "$NEED_TABLES" ]; then
  warn "表数量与备份清单不一致（备份时 $NEED_TABLES，现在 $GOT_TABLES），请核对"
fi

if [ "$DATA_ONLY" = 1 ]; then
  say "完成（仅恢复数据）"
  exit 0
fi

say "6. 启动应用"
( cd "$ROOT" && docker compose up -d ) || die "应用容器启动失败"
sleep 8
printf '  jxc-app：%s    jxc-db：%s\n' \
  "$(docker inspect -f '{{.State.Status}}' jxc-app 2>/dev/null || echo missing)" \
  "$(docker inspect -f '{{.State.Status}}' "$DB_CONT" 2>/dev/null || echo missing)"

say "7. 探活"
http_ok=0
if command -v curl >/dev/null 2>&1; then
  for i in $(seq 1 30); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:3000/ || true)"
    [ "$code" = "200" ] && { http_ok=1; break; }
    sleep 2
  done
fi
[ "$http_ok" = 1 ] && ok "首页 HTTP 200" || warn "首页未返回 200，等 1 分钟再刷新浏览器试试；仍不行看：docker logs jxc-app --tail 50"

docker logs --tail 5 jxc-app 2>&1 | sed 's/^/    /'

say "完成"
printf '  数据：已恢复（表 %s 张）\n  地址：http://本机IP:3000\n  登录：用备份时那套账号密码（admin / admin123 是初始值）\n' "$GOT_TABLES"
