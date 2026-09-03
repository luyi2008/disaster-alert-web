# 订阅页前端

`/devices/:id/subscribe` 的工作区仍是命令式 DOM（从原静态页迁入），不是 React 组件树。React 只包一层：无 BFF session 时重定向到 `/login`；设备不属于当前用户时回 `/devices`。`SubscribePage` 负责责任声明、把 shell 塞进宿主节点、调用 `mountSubscribeApp`（带上 `deviceId`），并在卸载时执行 teardown。

首页 `/` 按 session 跳到 `/devices` 或 `/login`。登录页是手机 OTP 与微信 mock。Bark token 只在设备列表里绑定，不解析测试链接。通知详情页 `/incidents/...` 不登录。

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
- 登录身份是 BFF cookie。订阅读写走 `/api/devices/:device_key/subscription` 与 `/api/devices/:device_key/subscribe`，不带 Bark token。401 回 `/login`，设备 404 回 `/devices`。
