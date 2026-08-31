# 订阅页前端

`/subscribe` 的工作区仍是命令式 DOM（从原静态页迁入），不是 React 组件树。React 只包一层：无登录会话（`disaster_bark_key` 或路由 state）时重定向到 `/`；否则 `SubscribePage` 负责责任声明、把 `shell.html` 塞进宿主节点、调用 `mountSubscribeApp`（带上 `deviceKey` 与 `onInvalidBarkKey`），并在卸载时执行返回的 teardown。

首页 `/` 是 React 入口页（粘贴 Bark 测试链接并校验 Key）。`/check` 通过后把 Key 写入 `disaster_bark_key`；已有会话则直接进订阅页。产品规则见 [bark-key-session-prd.md](bark-key-session-prd.md)。通知详情页 `/incidents/...` 也是 React。不要把订阅页的命令式拆分策略用到这两页。

## 改动顺序（已按此落地）

1. **Teardown**：`mountSubscribeApp` 返回卸载函数。地图 `remove()`、document 监听、定时器、逆地理编码 abort 都在这里收掉。`SubscribePage` 必须先 teardown，再清空宿主 HTML。
2. **查询范围**：所有 `#id` / 工作区选择器从宿主 `root` 查，不从 `ownerDocument` 查，避免和责任声明弹窗或其他路由抢节点。
3. **按职责拆文件并补类型**：见下方模块表。去掉 `@ts-nocheck`，文件纳入 `tsconfig.app.json`。

不要把整页一次性改成 React。模块稳定、有测试之后，才能按模块替换。

## 模块

| 文件 | 职责 |
| --- | --- |
| `shell.html` | 静态骨架（表单、地图容器） |
| `subscribeApp.ts` | 装配：Bark、提交/取消、配置加载、teardown |
| `runtime.ts` | 宿主查询、`SubscribeRuntime`、监听清理表 |
| `locations.ts` | Leaflet 地图与监测地点 |
| `alerts.ts` | 灾害类别、来源、烈度规则 |
| `status.ts` | `/api/status` 已连接数据源，展示在预警类型标题后 |
| `draft.ts` | 把服务端已保存订阅映射为表单草稿，并提供规范化与签名 |
| `toast.ts` | 页面内提示 |
| `http.ts` | API 响应解析 |
| `geo.ts` | 坐标与地点校验 |
| `types.ts` | 订阅草稿与运行时类型 |

共享可变状态集中在 `SubscribeRuntime`（`runtime.ts` 创建）。跨模块只通过 runtime 和各 `bind*` 返回的控制器通信。

## 卸载约定

- 生成代次 `initializationGeneration` 在 teardown 时递增，忽略进行中的 fetch。
- Leaflet：仅在 `map` 存在时调用 `map.remove()`。
- `ownerDocument` 上的 `pointerdown` / `keydown` 必须配对 `removeEventListener`。
- toast 定时器、逆地理编码 timeout/abort 全部取消。

## 不要做的

- 不要再给 `subscribeApp.ts` 堆新职责；新逻辑放到对应模块。
- 不要用 `document.getElementById` 找订阅页节点。
- 不要把未提交的表单草稿写入 localStorage；刷新时通过 Bearer `GET /api/subscriptions` hydrate，页面内编辑只保存在内存中。
- 登录身份在 `disaster_bark_key`；是否有效只认 `bark.mangguo.cloud/check`。订阅 502 或 Bearer 401 时复核 `/check`，仅在 `rejected` 时调用 `onInvalidBarkKey`。
