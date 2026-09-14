# Docker 构建与工程目录优化技术说明

日期：2026-09-14
状态：**已实施**

面向本仓库的静态站点镜像（多阶段：node 构建 → nginx 托管）。只涉及构建/部署，不改任何前端产品行为、路由、nginx 的 SPA 回退与安全响应头。

## 1. 背景与问题

- `.dockerignore` 未排除 `docs/`、`.cursor/`、`.github/`、测试文件，而 `Dockerfile` 的 `COPY . .` 把它们纳入构建上下文与层缓存哈希：改一次 `docs` 就会让 `npm run build` 层缓存失效、整站重编。
- 构建阶段用完整 `node:22-bookworm`（约 1.1GB），`npm ci` 无缓存挂载，重复构建每次重新下载依赖。
- 部署相关文件（`Dockerfile`、`nginx.conf`、`compose.yaml`）散落仓库根目录，语义未分组。

## 2. 目标与非目标

### 目标

- 提高构建缓存命中率、缩小构建上下文体积、加快重复构建。
- 缩小构建镜像体积。
- 把构建定义按语义归档，保持根目录整洁。

### 非目标

- 不改前端代码、路由、`nginx.conf` 的 SPA 回退与安全头。
- 不把 `compose.yaml` 与 `.dockerignore` 移出仓库根（见 §5 约束）。
- 不改 CI 的触发规则与部署链路（仅补充 Dockerfile 路径）。

## 3. 关键判定（实施前核查）

| 疑问 | 结论 | 依据 |
| --- | --- | --- |
| `.env` 排除出构建上下文是否影响生产？ | 否，且必须排除 | `Dockerfile`/`compose.yaml` 都不 COPY / 读取 `.env`。生产 `.env` 由 CI 生成 → scp 到宿主机 → `docker compose up` 在宿主机读取做变量替换，从不进镜像。`.dockerignore` 只作用于构建上下文。 |
| `.env.production` 能否一起排除？ | 否，需保留白名单 | Vite **构建期**读它，把 `CAPTCHA_ORIGIN` 烘进前端产物，必须进构建上下文（`!.env.production`）。 |
| 是否有原生编译依赖（node-gyp）？ | 无 | lockfile 中 `gypfile`/`install`/`postinstall` 脚本数为 0；`canvas` 只是 jsdom 的 optional peerDependency（`optional: true`），无 `node_modules/canvas` 安装节点，未安装。 |
| 构建工具链的"原生"部分？ | 预编译平台二进制，非本地编译 | esbuild / rollup / `@tailwindcss/oxide` / lightningcss 均提供 `linux-x64-gnu` 与 `linux-x64-musl` 变体，slim 与 alpine 皆可运行。 |

## 4. 改动清单（已落地）

| 改动 | 文件 | 收益 |
| --- | --- | --- |
| 补全忽略项（`docs`、`.cursor`、`.github`、`*.md`、`**/*.test.ts(x)`），保留 `!.env.example`、`!.env.production` | `.dockerignore` | 构建缓存命中、上下文瘦身 |
| 构建镜像 `node:22-bookworm` → `node:22-bookworm-slim` | `.docker/Dockerfile` | 约 1.1GB → ~250MB，glibc 同源零风险 |
| `npm ci` 加 `--mount=type=cache,target=/root/.npm` | `.docker/Dockerfile` | 重复构建复用 npm 缓存 |
| `Dockerfile` 与 `nginx.conf` 移入 `.docker/` | `.docker/` | 部署文件语义分组 |
| `COPY nginx.conf` → `COPY .docker/nginx.conf` | `.docker/Dockerfile` | 适配新路径（COPY 源相对构建上下文=根） |
| `build.dockerfile: .docker/Dockerfile`（context 仍为根） | `compose.yaml` | 适配新路径 |
| `file: .docker/Dockerfile` | `.github/workflows/container.yml` | 适配新路径 |

### 关于 `node:22-bookworm-slim` 与 alpine 的取舍

因多阶段构建，构建镜像**不进最终产物**（最终仍 `nginx:1.27-alpine`，~50MB）。alpine 构建镜像比 slim 再小约 70MB，对最终镜像无意义，却引入 musl 差异风险。故选 slim：大幅瘦身 + 与原 bookworm 完全同源、零行为差异。

## 5. 目录约束（必须遵守）

- **构建上下文 = 仓库根**：`Dockerfile` 里有 `COPY package.json`、`COPY . .`，故 `compose.yaml` 与 CI 的 `context` 必须是 `.`（根），仅用 `dockerfile`/`file` 指向 `.docker/Dockerfile`。
- **`.dockerignore` 必须在仓库根**：它只对构建上下文根生效，不能移进 `.docker/`。
- **`compose.yaml` 留根**：compose 默认在此查找，且 CI `scp-action` 与部署脚本 `cd $DEPLOY_PATH` 依赖根目录副本。

## 6. 验收

- 仅改 `docs` 后重建，`npm run build` 层命中缓存（BuildKit 日志显示 `CACHED`）。
- 最终镜像仍为 `nginx:1.27-alpine`，站点端口 30011 健康检查通过。
- `npm run build` 本地通过（本次以此验证；执行环境无 docker）。
- CI（`.github/workflows/container.yml`）构建 / 推送 / 部署链路不变，仅新增 Dockerfile 路径。

## 7. 实现对照

| 项 | 位置 |
| --- | --- |
| 构建 | [`.docker/Dockerfile`](../../../.docker/Dockerfile) |
| 托管 | [`.docker/nginx.conf`](../../../.docker/nginx.conf) |
| 编排 | [`compose.yaml`](../../../compose.yaml) |
| 上下文裁剪 | [`.dockerignore`](../../../.dockerignore) |
| CI | [`.github/workflows/container.yml`](../../../.github/workflows/container.yml) |
