# 进销存系统 · 飞牛 NAS 部署说明

> 适用：飞牛 fnOS（x86_64）已开启 Docker 功能。
> 本项目原本是「飞书妙搭」托管的 NestJS + React 全栈模板，已改造为**可完全离线自托管**版本，不再依赖任何妙搭平台服务。

---

## 一、为什么选飞牛 NAS，而不是 OpenWrt

| 维度 | OpenWrt | 飞牛 NAS |
|---|---|---|
| CPU 架构 | 多数为 ARM（路由器） | x86_64 |
| Node 22 + Vite 构建 | 路由器算力/Docker 支持都不足 | 完全够用 |
| PostgreSQL 服务端 | opkg 无官方包，需自行交叉编译 | 官方镜像开箱即用 |
| 结论 | **不推荐**（能跑但极不稳定） | **推荐** |

如果你的 OpenWrt 装在 x86 软路由上（4 核以上、≥2GB 内存、Docker 可用），理论上也能用本文档的同款镜像，把 compose 直接搬过去即可。

---

## 二、部署后的结构

```
浏览器 ──HTTP:3000──> [ jxc-app 容器 ]
                          │  NestJS 提供 /api/* 与前端页面
                          ▼
                      [ jxc-db 容器 ]  postgres:16-alpine
                          │
                          ▼
                  ./data/pg  （你的数据，全部在这里）
```

- 只有一个对外端口：**3000**
- 数据库只在内网互通，不对外暴露
- 所有数据落在 `./data/pg`，备份就是拷这个目录

---

## 三、部署前准备

1. 飞牛 NAS 打开 **Docker**（应用中心 → Docker，首次会提示初始化）。
2. 确认 NAS 能联网（构建镜像要拉 npm 包与基础镜像）。
3. 准备一个目录放项目，例如：`/vol1/1000/docker/jxc`。
   > 飞牛的 Docker 目录通常在「存储空间1」下，路径形如 `/vol1/1000/...`，以你 NAS 实际显示的为准。

---

## 四、部署步骤

### 4.1 上传项目

把整个 `jxcservices` 文件夹（含 `Dockerfile`、`docker-compose.yml`、`drizzle/`、`server/`、`client/`、`package.json`）上传到：

```
/vol1/1000/docker/jxc
```

> 不需要上传 `node_modules` 和 `dist`（`.dockerignore` 已排除，镜像里会重新装、重新构建）。

### 4.2 修改密码和端口（建议）

打开 `docker-compose.yml`，改这两处：

```yaml
POSTGRES_PASSWORD: jxc123456     # 改成你自己的强密码
DATABASE_URL: postgres://jxc:jxc123456@db:5432/jxc   # 密码要和上面完全一致
```

对外端口如需改（比如 3000 被占用）：

```yaml
ports:
  - "8080:3000"      # 宿主机用 8080，容器内仍是 3000
```

### 4.3 启动

在飞牛「Docker → Compose」里新建项目，指向 `/vol1/1000/docker/jxc/docker-compose.yml`，启动；
或者用 SSH：

```bash
cd /vol1/1000/docker/jxc
docker compose up -d --build
```

首次会构建镜像，**大约 8～20 分钟**（取决于 NAS 性能和网速）。

### 4.4 确认启动成功

```bash
docker compose ps
docker compose logs -f app
```

看到下面这句就成功了：

```
[Nest] ... Nest application successfully started
[Nest] ... Server running on 0.0.0.0:3000
```

浏览器打开：`http://<NAS的IP>:3000`

---

## 五、首次登录与初始化

- 账号：`admin`
- 密码：`admin123`

数据库容器**首次启动时**会自动执行 `drizzle/` 下的 SQL：
- `0000_shallow_baron_strucker.sql` —— 建 31 张业务表
- `seed.sql` —— 写入上面的 admin 账号

> 只初始化一次。之后重启容器不会重复执行，数据不会丢。

**首次登录后建议立刻改密码**：进「系统设置 → 用户管理」，或直接调接口。

---

## 六、日常运维

### 备份

数据全在 `./data/pg`，停止写入后直接打包即可：

```bash
docker compose stop app
tar -czf jxc-backup-$(date +%F).tar.gz data/pg
docker compose start app
```

或者用 pg_dump（不停机备份）：

```bash
docker compose exec db pg_dump -U jxc jxc > jxc-$(date +%F).sql
```

### 恢复

```bash
docker compose down
rm -rf data/pg
tar -xzf jxc-backup-2026-01-01.tar.gz
docker compose up -d
```

### 升级代码

```bash
cd /vol1/1000/docker/jxc
# 覆盖新代码（保留 data 目录）
docker compose up -d --build
```

`data/` 目录不要删，数据就在里面。

### 局域网/外网访问

- 局域网：直接 `http://NAS_IP:3000`
- 外网：飞牛自带「远程访问」，或用反向代理把 3000 端口映射出去；**务必先改管理员密码**，本系统没有强鉴权。

---

## 七、故障排查

| 现象 | 原因 / 处理 |
|---|---|
| 构建报 `failed to resolve source metadata for docker.io/library/node:22-alpine … 401 Unauthorized` | 飞牛自带的镜像加速器 `docker.fnnas.com` 对 node 镜像返回 401，见下方「镜像拉不动怎么办」 |
| 构建前出现 `Image jxc-app:latest Pulling` → `context deadline exceeded` | 旧包里 compose 多写了一行 `image:`，Docker 会先去仓库找这个不存在的 tag。**新包已删除该行**，用最新版即可 |
| `docker compose up` 报 `permission denied` 操作 `data/pg` | 目录属主不对，执行 `sudo chown -R 999:999 ./data/pg`（postgres 镜像内 UID 是 999） |
| app 日志报 `缺少 DATABASE_URL 环境变量` | compose 里的 `environment` 没生效，检查缩进（YAML 用空格，不用 Tab） |
| app 日志报 `ECONNREFUSED db:5432` | db 还没起来或健康检查没过，`docker compose logs db` 看是否 `database system is ready` |
| 页面 200 但白屏 | 前端静态资源 404：确认构建阶段 `vite build` 成功，镜像内 `/app/dist/client` 有 `index.html` 与 `assets/` |
| 登录提示「用户名或密码错误」 | `sys_user` 表里没有记录。确认是首次启动（`data/pg` 是空的），否则手动执行 `drizzle/seed.sql` |
| 改动 schema 后表结构没变 | 初始化脚本只跑一次。需要 `docker compose down && rm -rf data/pg` 重建，或手动 psql 执行新迁移 |
| 构建卡在 `npm install` | 网络问题。可在 Dockerfile 里把 registry 换成你的内网 npm 镜像 |
| 端口 3000 被占用 | 改 `ports` 左侧为 8080 等空闲端口 |

### 镜像拉不动怎么办（docker.fnnas.com 返回 401）

飞牛 Docker 默认把镜像请求转给 `https://docker.fnnas.com`，这个加速器对部分镜像（比如 `library/node`）会返回 **401 Unauthorized**。本次日志里 `postgres:16-alpine` 能拉成功，说明 **Docker 本身能上网，只是这个加速器对 node 镜像没放行**。

四条出路，从省事到彻底：

**方案 A：复用 NAS 上已有的 node 镜像（最快，不动系统配置）**

```bash
docker images | grep -i node
```

如果看到比如 `node:20-alpine`，打个同名 tag 顶上去，Docker 就不会再去仓库请求：

```bash
docker tag node:20-alpine node:22-alpine
```

（Node 20 跑这个项目也完全没问题，只是 `engines` 里写的是 >=22，仅提示不影响。）

**方案 B：先手动拉一次，确认是加速器还是网络问题**

```bash
docker pull node:22-alpine
```

- 报同样的 401 → 确实是加速器问题，走方案 C
- 拉成功了 → 说明只是一时的 metadata 请求失败，直接重新构建

**方案 C：换掉镜像加速器（根治）**

飞牛面板：**Docker → 设置 → 镜像加速**，填公共加速器，例如：

```
https://docker.1ms.run
https://docker.xuanyuan.me
```

或者 SSH 改 `/etc/docker/daemon.json`：

```json
{
  "registry-mirrors": ["https://docker.1ms.run", "https://docker.xuanyuan.me"]
}
```

然后 `systemctl restart docker`。
> 注意：重启 Docker 会**把所有正在运行的容器一起重启**，挑个空档做。

**方案 D：换一个能拉到的基础镜像（兜底）**

Dockerfile 里基础镜像是参数化的，不用改文件：

```bash
docker compose build --build-arg NODE_IMAGE=node:20-alpine
docker compose up -d
```

也可以写进 compose 固化：

```yaml
  app:
    build:
      context: .
      args:
        NODE_IMAGE: node:20-alpine
```

---

## 八、当前版本的已知限制

改造只解决了「能脱离妙搭跑起来」这一目标，以下功能是平台专属、本地未实现：

1. **文件/图片上传**（妙搭 dataloom 对象存储）：相关页面暂不可用，需改存本地磁盘或 MinIO。
2. **用户鉴权**：只有登录页挡一下，接口层面没有 token 校验（`NeedLogin` 在本地退化为空装饰器）。局域网自用可以，公网暴露前必须加反向代理认证。
3. **妙搭 Inspector / 协作 / 聊天选人**等平台组件：已整体移除。
4. **`client/src/components/business-ui/`** 里有一批平台组件死代码，不影响运行，可后续删除。

如需补齐其中任意一项，告诉我优先级，我按顺序改。
