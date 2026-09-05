# 订阅页前端

`/devices/:id/subscribe` 是 React 工作区。`SubscribePage` 负责登录校验、设备归属、责任声明弹窗和 `AppShell`；`SubscribeWorkspace` 负责地点、预警规则、保存和取消订阅。

首页 `/` 按 session 跳到 `/devices` 或 `/login`。登录页是手机 OTP 与微信 mock。Bark token 只在设备列表里绑定。通知详情页 `/incidents/...` 不登录。

## 模块

| 文件 | 职责 |
| --- | --- |
| `SubscribeWorkspace.tsx` | 加载已保存订阅、保存、取消订阅、重置规则确认 |
| `LocationPanel.tsx` | Leaflet 地图与监测地点编辑 |
| `AlertRulesPanel.tsx` | 灾害类别、来源、烈度规则 |
| `alertLogic.ts` | 规则校验、sanitize、烈度分段 |
| `statusSources.ts` | `/api/status` 已连接数据源标签 |
| `notify.ts` | sonner 提示 |
| `draft.ts` | 服务端订阅映射为表单草稿 |
| `geo.ts` | 坐标与地点校验 |
| `http.ts` | API 响应解析 |
| `types.ts` | 订阅草稿类型 |

弹窗用 shadcn `AlertDialog`（取消订阅、重置规则）。按钮、输入框用 shadcn `Button` / `Input`。

Leaflet 仍在 `useEffect` 里创建，卸载时 `map.remove()`，逆地理编码 abort。

不要把未提交的表单草稿写入 localStorage；刷新时通过 `GET /api/devices/:device_key/subscription` hydrate。登录身份是 BFF cookie。401 回 `/login`，设备 404 回 `/devices`。
