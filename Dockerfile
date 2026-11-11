# 基础镜像可用 --build-arg NODE_IMAGE=... 覆盖。
# 如果 NAS 的镜像加速器拉不动 node:22-alpine，见部署说明「七、故障排查」第 1 条。
ARG NODE_IMAGE=node:22-alpine

# ---------- 构建阶段 ----------
FROM ${NODE_IMAGE} AS builder
WORKDIR /app

# 国内网络加速（飞牛 NAS 在国内，直连官方源容易超时）
RUN npm config set registry https://registry.npmmirror.com

# 先只拷依赖清单，利用 Docker 层缓存
COPY package.json package-lock.json ./
RUN npm install --ignore-scripts

# 再拷源码构建
COPY . .
# 先生成 shared 的类型声明（dist/shared/*.d.ts）：客户端与后端都靠它做类型解析，
# 缺了这一步在"没有历史 dist"的全新目录里 nest build 会报 TS6305 直接失败
RUN npx tsc -b tsconfig.node.json
RUN npx nest build
RUN npx vite build --config vite.config.ts

# ---------- 运行阶段 ----------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com

ENV NODE_ENV=production \
    TZ=Asia/Shanghai \
    SERVER_HOST=0.0.0.0 \
    SERVER_PORT=3000

# 备份还原要用的 pg_dump / pg_restore / psql：alpine 走 apk，debian 系走 apt，
# 两种都没有就跳过（那时页面会提示「当前镜像里没有 pg_dump」，其他功能不受影响）
RUN if command -v apk >/dev/null 2>&1; then \
        apk add --no-cache postgresql16-client; \
    elif command -v apt-get >/dev/null 2>&1; then \
        apt-get update && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/*; \
    fi

# 只装生产依赖（前端已打包进 dist/client，不需要 antd/vite 等）
COPY package.json package-lock.json ./
RUN npm install --omit=dev --ignore-scripts \
    && npm cache clean --force

# 后端编译产物 + 前端静态资源
COPY --from=builder /app/dist ./dist
# 迁移脚本与初始数据（首次启动由数据库容器执行）
COPY drizzle ./drizzle

# 备份目录（docker-compose 里挂到宿主机 ./backup）
RUN mkdir -p /app/backup && chown -R node:node /app/backup

EXPOSE 3000

# 不需要 root：node 镜像自带 node 用户
USER node

CMD ["node", "dist/server/main.js"]
