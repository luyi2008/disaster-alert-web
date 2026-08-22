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

`git push` 到 `main` 会构建 Docker 镜像并推送到 `ghcr.io/<owner>/<repo>:latest`，随后用仓库 secrets SSH 部署该容器。不引用、不构建 `disaster-alert`。

需要配置的 secrets：

- `DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_SSH_KEY`：SSH 登录
- `DEPLOY_SCRIPT`：远端拉起前端容器的命令，例如 `docker pull ghcr.io/luyi2008/disaster-alert-web:latest && docker up -d`

镜像内是 nginx 托管的静态资源。`/incidents/` 会回退到 `index.html`，Bark 深链刷新不会 404。

站点若与 API 共用域名，由运维反代：

```
/api/*  /health  -> disaster-alert
/  /incidents/*  -> 本镜像
```

反代、CDN 和日志不要记录 `/incidents/` 的完整 URL（路径里含通知凭据）。

契约快照见 [docs/openapi.yaml](docs/openapi.yaml)。API 变更后请人工同步，不要在 CI 里拉取服务端仓库。
