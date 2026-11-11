#!/usr/bin/env bash
# 一键恢复.sh —— 给完全不想看命令行的人用：双击/一条命令，剩下的它自己干
#
# 用法：把「备份包 .tgz」和这个脚本放在同一个文件夹里，然后
#   bash 一键恢复.sh
#
# 它会：检查 docker 有没有装 → 找到同目录里最新的备份包 → 调 jxc-restore.sh 全自动恢复
# 出来问题就把屏幕上最后 20 行发给维护的人看。

set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="${JXC_ROOT:-/vol1/1000/jxc}"
RESTORE=""

echo
echo "======================================================"
echo "   进销存 一键恢复"
echo "======================================================"
echo
echo "  项目目录：$ROOT"
echo "  脚本目录：$HERE"
echo

# 1) docker 有没有
if ! command -v docker >/dev/null 2>&1; then
  echo "  [×] 这台机器上没装 docker，先装它：飞牛「应用中心 → Docker」，装完再跑这个脚本。"
  exit 1
fi
if ! docker ps >/dev/null 2>&1; then
  echo "  [×] docker 在，但当前账号没权限用它（或服务没启动）。"
  echo "      先启动 Docker 服务；实在不行用有权限的账号（root）来跑。"
  exit 1
fi
echo "  [√] docker 可用"

# 2) 找恢复脚本：优先项目目录，其次当前目录
for p in "$ROOT/scripts/jxc-restore.sh" "$ROOT/jxc-restore.sh" "$HERE/jxc-restore.sh"; do
  if [ -f "$p" ]; then RESTORE="$p"; break; fi
done
if [ -z "$RESTORE" ]; then
  echo "  [×] 找不到 jxc-restore.sh。把它和备份包一起放到 $ROOT 目录里再跑。"
  exit 1
fi
echo "  [√] 恢复脚本：$RESTORE"

# 3) 找备份包：用「最新」的那一个（最新 = 代码与数据都最接近现在）
#    最新的包要是没带镜像，就让恢复脚本用源码重建（需联网）
PKG=""
PKG_NEEDS_BUILD=0
for d in "$ROOT/backup" "$HERE" "$ROOT"; do
  [ -d "$d" ] || continue
  for p in "$d"/*.tgz; do
    [ -f "$p" ] || continue
    if [ -z "$PKG" ] || [ "$p" -nt "$PKG" ]; then PKG="$p"; fi
  done
done
if [ -z "$PKG" ]; then
  echo "  [×] 没找到备份包（*.tgz）。把备份包放到 $ROOT/backup/ 或本目录。"
  exit 1
fi
listing="$(tar -tzf "$PKG" 2>/dev/null || true)"
case "$listing" in
  *image/jxc-app.tar*) ;;
  *) PKG_NEEDS_BUILD=1 ;;
esac
echo "  [√] 备份包：$(basename "$PKG")（$(du -h "$PKG" 2>/dev/null | cut -f1)）"
if [ "$PKG_NEEDS_BUILD" = 1 ]; then
  echo "      （这个包不带镜像，会用源码重建，需联网，约 2~3 分钟）"
fi
echo

echo "  大约 2~5 分钟，中途别关窗口。开始恢复……"
echo
bash "$RESTORE" "$PKG" --yes
rc=$?

echo
if [ "$rc" = 0 ]; then
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  echo "======================================================"
  echo "   恢复完成"
  echo "======================================================"
  echo "   浏览器打开：http://${IP:-本机IP}:3000"
  echo "   账号密码：和备份时那套一样（出厂是 admin / admin123）"
else
  echo "======================================================"
  echo "   恢复中途停了（退出码 $rc）"
  echo "======================================================"
  echo "   把上面带 [FAIL] 的那几行发给维护的人，别重复重跑。"
fi
exit "$rc"
