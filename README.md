# 灾害预警网页

[disaster-alert](https://github.com/luyi2008/disaster-alert) 的订阅页和通知详情页。本仓库只包含前端，不运行灾害数据源或 Bark 推送。

服务端完全独立发版，两边不需要对齐 git tag。

## 本地开发

先在 API 仓库启动 `disaster-alert`（默认 `http://127.0.0.1:30010`），再：

```bash
npm install
npm run dev
```

Vite 会把 `/api` 和 `/health` 代理到 API。浏览器打开 Vite 地址即可。

可选环境变量：

- `VITE_DEV_API_ORIGIN`：开发代理目标，默认 `http://127.0.0.1:30010`
- `VITE_API_BASE`：构建时 API 前缀。同源反代时保持为空

```bash
npm test
npm run build
```

## 部署

本仓库推荐用 Docker Compose 跑静态站点。镜像内是 nginx，容器始终监听 `0.0.0.0:30011`。GitHub Actions 在 PR 上只构建镜像、不上传；合并进 `main` 或手动 `workflow_dispatch` 后，把镜像上传到 GitHub Container Registry（`ghcr.io`，不是 Docker Hub），再 SSH 到与 [disaster-alert](https://github.com/luyi2008/disaster-alert) 相同的运行环境（本项目实例是阿里云 ECS）拉取并重启容器。不引用、不构建 `disaster-alert`。

### Docker Compose

```bash
git clone https://github.com/luyi2008/disaster-alert-web.git
cd disaster-alert-web
cp .env.example .env
docker compose up -d --build
```

生产环境也可以不在主机上构建，改为拉取 CI 推送的镜像：

```bash
export DISASTER_ALERT_WEB_IMAGE=ghcr.io/luyi2008/disaster-alert-web:latest
docker compose pull
docker compose up -d --no-build
```

未设置 `DISASTER_ALERT_WEB_IMAGE` 时，Compose 默认使用上述 `latest` 标签。

### 合并到 main 后的自动部署

触发规则与 API 仓库一致：PR 只构建、不推送、不部署；推到 `main` 或在 `main` 上手动运行 workflow 才会上传镜像并部署。

`main` 上的 [container workflow](.github/workflows/container.yml) 会：

1. 构建镜像并上传到 `ghcr.io/<owner>/<repo>:latest`（同时打提交 SHA 标签；不是 Docker Hub）
2. 把当前提交的 `compose.yaml` 拷到主机上的部署目录
3. 把 GitHub Secret `DEPLOY_ENV_FILE` 写成该目录下的 `.env`（未配置时使用 [.env.example](.env.example)）
4. 用本次 job 的 `GITHUB_TOKEN` 登录 `ghcr.io`、拉取镜像，并以 `--no-build` 重启容器

需要在本仓库 Settings → Secrets and variables → Actions 配置：

| Secret | 用途 |
| --- | --- |
| `DEPLOY_HOST` | 与 API 相同的 ECS 公网 IP 或 SSH 主机名 |
| `DEPLOY_USER` | SSH 用户 |
| `DEPLOY_SSH_KEY` | 该用户的私钥（仅用于部署） |
| `DEPLOY_PATH` | 主机上放置本仓库 `compose.yaml` 与 `.env` 的目录（不要与 API 的目录混用） |
| `DEPLOY_ENV_FILE` | 可选。整份生产 `.env` 文本，结构见 [.env.example](.env.example) |

`DEPLOY_PATH` 必须和 API 仓库分开，否则会互相覆盖 `compose.yaml`。SSH 登录信息可以与 `disaster-alert` 相同。

首次在 ECS 上准备一次即可：安装 Docker 与 Compose 插件、把部署公钥写入 `authorized_keys`、创建可写的 `DEPLOY_PATH`。容器和主机发布端口默认都是 `0.0.0.0:30011`。对外 HTTPS 仍由主机上的反向代理处理（配置不在本仓库）。

PR 不会部署、也不会写 `.env`。未配置上述 secrets 时，合并后的 deploy job 会失败；镜像若已上传仍会留在 `ghcr.io`。

镜像内是 nginx 托管的静态资源。`/incidents/` 会回退到 `index.html`，Bark 深链刷新不会 404。

站点若与 API 共用域名，由运维反代：

```
/api/*  /health  -> disaster-alert（默认 127.0.0.1:30010）
/  /incidents/*  -> 本镜像（0.0.0.0:30011）
```

反代、CDN 和日志不要记录 `/incidents/` 的完整 URL（路径里含通知凭据）。

契约快照见 [docs/openapi.yaml](docs/openapi.yaml)。API 变更后请人工同步，不要在 CI 里拉取服务端仓库。

订阅页（`/`）的 DOM 工作区如何拆分、卸载和查询节点，见 [docs/subscribe-frontend.md](docs/subscribe-frontend.md)。
