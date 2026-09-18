# 订阅页前端

`/devices/:id/subscribe` 是 React 工作区。`SubscribePage` 负责 session、设备归属、责任声明和外壳；`SubscribeWorkspace` 渲染地点、预警规则、保存和取消订阅。

首页 `/` 按 session 跳到 `/devices` 或 `/login`。登录页是手机 OTP 与微信 mock。Bark token 只在设备列表里绑定，不解析测试链接。通知详情页 `/incidents/...` 不登录。

## 模块

| 文件 | 职责 |
| --- | --- |
| `SubscribeWorkspace.tsx` | 装配：hydrate、保存、取消订阅、重置规则 |
| `LocationPanel.tsx` | Leaflet 地图与监测地点 |
| `AlertRulesPanel.tsx` | 灾害类别、来源、烈度规则 |
| `alertLogic.ts` | 规则 sanitize / 校验 |
| `statusSources.ts` | `/api/status` 已连接数据源 |
| `notify.ts` | sonner 提示 |
| `draft.ts` | 服务端订阅映射为草稿 |
| `geo.ts` | 坐标与地点校验 |
| `http.ts` | API 响应解析 |
| `types.ts` | 订阅草稿类型 |

共享草稿由 `SubscribeWorkspace` 持有，地点与规则面板通过 `setDraft` 更新。弹窗为 shadcn `AlertDialog`。

## 卸载约定

- `LocationPanel` 在 effect cleanup 里 `map.remove()`，并 abort 进行中的逆地理编码。
- 配置加载用本地 `cancelled` / generation 忽略过期响应。

## 不要做的

- 不要把未提交的表单草稿写入 localStorage。
- 登录身份是 BFF cookie。订阅读写走 `/api/devices/:device_key/subscription` 与 `/api/devices/:device_key/subscribe`。401 回 `/login`，设备 404 回 `/devices`。
