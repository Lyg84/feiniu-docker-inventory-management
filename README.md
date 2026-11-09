# 进销存 Web 版

面向小型商贸/办公设备门店的进销存系统：客户、商品、送货单、收款单、入库/出库、领料、财务、库存与操作日志。

- 后端：NestJS + Drizzle ORM + PostgreSQL
- 前端：React + Vite + Tailwind
- 部署：Docker Compose（应用 + PostgreSQL），带一键部署包
- 打印：送货单二联版式（241×140mm），客户端打印通道 electron-hiprint

## 目录结构

```
server/            NestJS 后端（modules/ 下按业务分模块）
client/            React 前端（pages/ 按业务分页面）
shared/            前后端共用类型与接口定义
db/init/           首次建库 SQL（31 张表 + 初始账号 + 平台角色授权）
scripts/           运维与构建辅助脚本
```

## 本地运行

```bash
npm install --ignore-scripts      # 项目的 postinstall 依赖平台 CLI，必须忽略
npm run build:server
npm run build:client
node dist/server/main.js
```

必需环境变量：

| 变量 | 说明 |
|---|---|
| `SUDA_DATABASE_URL` | `postgres://用户:密码@主机:5432/库名` |
| `SERVER_PORT` | 默认 3000 |
| `SERVER_HOST` | 默认 0.0.0.0 |
| `NODE_ENV` | 生产用 `production`；排障用 `development`（production 下异常会静默杀进程） |

## Docker 部署（飞牛 NAS / 任意 Linux）

```bash
bash install.sh
```

脚本会生成 `.env`（随机数据库密码）、建数据目录、`docker compose up -d`，并轮询首页直到就绪。
首次启动时 PostgreSQL 自动执行 `db/init/01-schema.sql` 建表并写入初始账号。

默认访问 `http://<主机IP>:3000/`，初始账号 `admin / admin123`（上线后请立即在用户管理里改密码）。

## 操作日志

`sys_log` 表 + `GET /api/sys-logs` 接口 + 前端「系统设置 → 操作日志管理」。
写入由全局拦截器 `server/modules/system/sys-log.interceptor.ts` 完成：所有 `POST/PUT/PATCH/DELETE` 记一条，`GET/HEAD/OPTIONS` 不记；密码类与 token 类字段打码；审计失败只记 warn，不影响业务。

## 数据库备份

```bash
docker exec jxc-db pg_dump -U jxc jxc > jxc_$(date +%Y%m%d).sql
cat jxc_20261109.sql | docker exec -i jxc-db psql -U jxc -d jxc
```

## 说明

- 该仓库为私有仓库，含默认演示账号，请勿直接用于公网暴露部署。
- `db/init/01-schema.sql` 里的 `admin/admin123` 仅用于首次登录，生产环境请改密码并收紧数据库端口。
