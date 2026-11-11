#!/usr/bin/env bash
# jxc-backup.sh —— 进销存整机备份（数据 + 部署文件 + 镜像，重装系统后能一键还原）
#
# 用法：
#   bash scripts/jxc-backup.sh                 # 默认：库 dump + 部署文件 + 应用镜像
#   bash scripts/jxc-backup.sh --no-image      # 不打包镜像（包小很多，恢复时需要有源码能重建）
#   bash scripts/jxc-backup.sh --keep 10       # 只保留最近 10 个包（默认 10）
#   bash scripts/jxc-backup.sh --out /vol1/1000/jxc/backup
#   bash scripts/jxc-backup.sh --offsite /vol1/1000/jxc_backup_offsite   # 另存第二份（异地/别的盘）
#
# 产物：<out>/jxc_backup_YYYYMMDD_HHMM.tgz
#   内含 db.dump（pg_dump 自定义格式）、deploy/（compose + Dockerfile + drizzle + 源码 + 脚本）、
#        image/jxc-app.tar（可选）、manifest.txt（版本/大小/哈希/表数量）
#
# 环境变量：JXC_ROOT（默认 /vol1/1000/jxc）、JXC_IMAGE（默认 jxc-app:latest）、
#           JXC_OFFSITE（异地目录，等价于 --offsite）

set -uo pipefail

ROOT="${JXC_ROOT:-/vol1/1000/jxc}"
IMAGE="${JXC_IMAGE:-jxc-app:latest}"
DB_CONT="${JXC_DB_CONTAINER:-jxc-db}"
OUT=""
OFFSITE="${JXC_OFFSITE:-}"
WITH_IMAGE=1
KEEP=10
TS="$(date +%Y%m%d_%H%M)"

say() { printf '\n== %s ==\n' "$*"; }
ok()  { printf '  [OK]   %s\n' "$*"; }
bad() { printf '  [FAIL] %s\n' "$*"; }
warn(){ printf '  [WARN] %s\n' "$*"; }
die() { bad "$*"; printf '\n备份已中止。\n'; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --no-image)   WITH_IMAGE=0; shift ;;
    --with-image) WITH_IMAGE=1; shift ;;
    --keep)       KEEP="${2:-10}"; shift 2 ;;
    --out)        OUT="${2:-}"; shift 2 ;;
    --offsite)    OFFSITE="${2:-}"; shift 2 ;;
    -h|--help)    sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)            die "未知参数：$1" ;;
  esac
done
OUT="${OUT:-$ROOT/backup}"

say "0. 环境预检"
[ -d "$ROOT" ] || die "项目目录不存在：$ROOT"
[ -f "$ROOT/docker-compose.yml" ] || die "找不到 $ROOT/docker-compose.yml"
command -v docker >/dev/null 2>&1 || die "docker 命令不可用"
docker inspect -f '{{.State.Running}}' "$DB_CONT" 2>/dev/null | grep -q true \
  || die "数据库容器 $DB_CONT 未运行"
ok "项目目录：$ROOT"
ok "数据库容器：$DB_CONT（运行中）"

NAME="jxc_backup_${TS}.tgz"
mkdir -p "$OUT" || die "建不了输出目录：$OUT"
[ -w "$OUT" ] || die "输出目录不可写：$OUT"

WORK="$(mktemp -d)" || die "建不了临时目录"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/deploy" "$WORK/image"

say "1. 导出数据库"
DUMP="$WORK/db.dump"
docker exec "$DB_CONT" pg_dump -U jxc -Fc -d jxc > "$DUMP" \
  || die "pg_dump 失败（容器 $DB_CONT 里是否有 pg_dump？）"
[ -s "$DUMP" ] || die "dump 文件是空的"
DUMP_SHA="$(sha256sum "$DUMP" | awk '{print $1}')"
DUMP_SIZE="$(stat -c %s "$DUMP")"
ok "db.dump：${DUMP_SIZE} 字节，sha256 ${DUMP_SHA:0:16}…"

TABLES="$(docker exec "$DB_CONT" psql -U jxc -d jxc -t -A -c \
  "select count(*) from information_schema.tables where table_schema='public'" 2>/dev/null | tr -d ' \r\n')"
DB_SIZE="$(docker exec "$DB_CONT" psql -U jxc -d jxc -t -A -c \
  "select pg_size_pretty(pg_database_size('jxc'))" 2>/dev/null | tr -d ' \r\n')"
ok "表数量：${TABLES:-?}，库大小：${DB_SIZE:-?}"

say "2. 收部署文件"
for f in docker-compose.yml Dockerfile .dockerignore .env.example jxc-update.sh 运行说明.txt 飞牛NAS部署说明.md \
         package.json package-lock.json nest-cli.json \
         tsconfig.json tsconfig.app.json tsconfig.node.json tsconfig.build.json \
         vite.config.ts index.html postcss.config.js tailwind.config.js tailwind.config.ts \
         components.json drizzle.config.ts eslint.config.js; do
  [ -f "$ROOT/$f" ] && cp -p "$ROOT/$f" "$WORK/deploy/" 2>/dev/null
done
# 源码目录一起收进来：恢复后能继续 docker compose build / 打增量补丁，否则只能跑现成镜像
for d in drizzle scripts server client shared; do
  [ -d "$ROOT/$d" ] && tar -cf - -C "$ROOT" --exclude='node_modules' "$d" 2>/dev/null | tar -xf - -C "$WORK/deploy" 2>/dev/null
done
DEPLOY_N="$(find "$WORK/deploy" -type f | wc -l | tr -d ' ')"
# fnOS 下拷出来的文件可能带 000 权限位，打包前统一放开，否则 tar 会 Permission denied
chmod -R a+rX "$WORK/deploy" 2>/dev/null || true
ok "部署文件 + 源码：${DEPLOY_N} 个文件（compose / Dockerfile / drizzle / scripts / server / client / shared 等）"

if [ "$WITH_IMAGE" = 1 ]; then
  say "3. 打包应用镜像（473MB 左右，慢一点属正常）"
  if docker image inspect "$IMAGE" >/dev/null 2>&1; then
    docker save "$IMAGE" -o "$WORK/image/jxc-app.tar" || die "docker save 失败"
    IMG_SIZE="$(stat -c %s "$WORK/image/jxc-app.tar")"
    ok "image/jxc-app.tar：${IMG_SIZE} 字节"
  else
    bad "找不到镜像 $IMAGE，跳过镜像打包"
    WITH_IMAGE=0
  fi
else
  say "3. 跳过镜像打包（--no-image）"
fi

IMG_ID="$(docker inspect -f '{{.Image}}' jxc-app 2>/dev/null | cut -c9-20)"
{
  echo "jxc 进销存备份清单"
  echo "备份时间：$(date '+%F %T')"
  echo "宿主机项目目录：$ROOT"
  echo "应用镜像：$IMAGE（$IMG_ID）"
  echo "数据库容器：$DB_CONT（postgres:16-alpine）"
  echo "库名：jxc  表数量：${TABLES:-?}  库大小：${DB_SIZE:-?}"
  echo "db.dump 字节数：$DUMP_SIZE  sha256：$DUMP_SHA"
  echo "部署文件数量：$DEPLOY_N"
  echo "是否包含镜像：$([ "$WITH_IMAGE" = 1 ] && echo 是 || echo 否)"
  echo ""
  echo "恢复方法：bash jxc-restore.sh --yes（把本包和 jxc-restore.sh 放在同一个目录，脚本会自动选它）"
} > "$WORK/manifest.txt"

say "4. 打包"
PKG="$OUT/$NAME"
tar -czf "$PKG" -C "$WORK" . || die "打包失败"
PKG_SIZE="$(stat -c %s "$PKG")"
PKG_SHA="$(sha256sum "$PKG" | awk '{print $1}')"
ok "备份包：$PKG"
printf '  大小：%s 字节（%.1f MB）\n  SHA256：%s\n' \
  "$PKG_SIZE" "$(awk -v s="$PKG_SIZE" 'BEGIN{print s/1048576}')" "$PKG_SHA"

say "5. 另存第二份（异地 / 别的盘）"
if [ -n "$OFFSITE" ]; then
  mkdir -p "$OFFSITE" || warn "异地目录建不了：$OFFSITE（跳过）"
  if [ -d "$OFFSITE" ]; then
    cp -f "$PKG" "$OFFSITE/$NAME" && ok "已复制到 $OFFSITE/$NAME"
    # fnOS 卷上 cp 出来的副本会带 000 权限位，读都读不了，复制完统一放开
    chmod 644 "$OFFSITE/$NAME" 2>/dev/null || warn "异地副本权限调整失败，请手工 chmod 644 $OFFSITE/$NAME"
    # 把恢复脚本一起放过去，这个目录单独拿走就能恢复（包里 + 一个脚本，两步到位）
    if [ -f "$ROOT/scripts/jxc-restore.sh" ]; then
      cp -f "$ROOT/scripts/jxc-restore.sh" "$OFFSITE/jxc-restore.sh" \
        && chmod 755 "$OFFSITE/jxc-restore.sh" 2>/dev/null \
        && ok "恢复脚本已同步：$OFFSITE/jxc-restore.sh"
    fi
    off_sha="$(sha256sum "$OFFSITE/$NAME" 2>/dev/null | awk '{print $1}')"
    [ "$off_sha" = "$PKG_SHA" ] && ok "异地副本哈希与源一致" || warn "异地副本哈希不一致，请重拷"
    ls -1t "$OFFSITE"/jxc_backup_*.tgz 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do
      rm -f "$old" && printf '  删除异地旧包：%s\n' "$(basename "$old")"
    done
  fi
else
  printf '  未配置异地目录（--offsite 或 JXC_OFFSITE），建议手动拷一份到移动硬盘/另一台机器\n'
fi

say "6. 清理旧包（保留最近 ${KEEP} 个）"
ls -1t "$OUT"/jxc_backup_*.tgz 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do
  rm -f "$old" && printf '  删除旧包：%s\n' "$(basename "$old")"
done

say "完成"
printf '  下一步：把 %s 复制到别的机器/移动硬盘一份，重装系统后用它 + scripts/jxc-restore.sh 恢复。\n' "$(basename "$PKG")"
