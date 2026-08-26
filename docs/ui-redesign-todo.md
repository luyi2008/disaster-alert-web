# TODO：UI 改版与小程序同构准备

**状态：待评审。清单本身也是评审对象 —— 如有遗漏或优先级异议，请直接在 PR 上指出。**

配套文档：选型论证见 [ui-stack-selection.md](ui-stack-selection.md)，阶段划分与验收标准见 [ui-redesign-plan.md](ui-redesign-plan.md)。

图例：`[ ]` 未开始 · `[x]` 已完成 · `[!]` 被阻塞 · **粗体** 为阻塞其他任务的关键项

---

## P0 决策与验证（进行中）

此阶段不写业务代码，只消除会推翻后续方案的未知项。

### 需要你答复

- [!] **Q1：小程序主体是个人还是企业/组织？** — 阻塞 P4 全部、P2 组件库选择、P3 是否值得投入
- [!] **Q2：视觉风格统一到哪一套？** Apple 灰蓝 / 墨绿 / 重新定 — 阻塞 P1 的 token 统一
- [!] Q3：是否直接按移动优先重做？ — 影响 P2 组件库选择
- [!] Q4：目标用户浏览器版本分布？ — 决定 Tailwind v4 的浏览器要求是否可接受
- [!] Q5：字体栈是否现在就改？ — 唯一会立刻改变观感的改动

### 技术验证（spike，代码不进主干）

- [ ] **验证 NutUI React 与 React 19 的兼容性** — 组件库方案最大未知项，阻塞 P2
- [ ] 结合 Q4 结论，确认 Tailwind v4 的浏览器要求（Safari 16.4+ / Chrome 111+ / Firefox 128+）是否可接受
- [ ] 确认小程序类目审核可行性（灾害预警属受监管内容） — 阻塞 P4

### 决策记录

- [ ] 若 Q1 = 个人主体 → 触发 D1：放宽同构约束，重评估组件库（shadcn/ui + Radix 可能成为更优选）
- [ ] 若 NutUI 不兼容 React 19 → 触发 D2：优先「自建 + Tailwind」，而非降级 React
- [ ] 若老旧设备占比高 → 触发 D3：Tailwind v4 降 v3，或改用 CSS Modules 退路

---

## P1 视觉基础

依赖：Q2、Q5 已答复。这是本轮观感改善的主要来源。

### 字体

- [ ] 修 `src/styles/subscribe.css:40` 的 Arial 前置，改为系统字体栈
- [ ] 修 `src/styles/subscribe.css:472` 的第二处 `font-family: Arial, sans-serif`
- [ ] 确认 `detail.css` 的 Inter 字体栈是否并入统一方案

### 设计 token 统一

- [ ] 按 Q2 确定最终调色板，产出 token 清单
- [ ] 新建 `src/styles/theme.css` 作为 token 单一真相源
- [ ] 移除 `subscribe.css` 的 `:root` 声明
- [ ] 移除 `detail.css` 的 `:root` 声明
- [ ] **验证 token 覆盖缺陷已消除** —— 产物中 `:root` 不再有取值冲突的同名 token（`--muted` / `--line` / `--panel`）
- [ ] 为详情页补上深色模式（当前 `detail.css` 完全没有）

### Tailwind 接入

- [ ] 安装 `tailwindcss@4` 与 `@tailwindcss/vite@4`
- [ ] `vite.config.ts` 注册插件
- [ ] `theme.css` 中只引入 theme + utilities 层，**不引入 Preflight**（否则破坏 853 行存量 CSS）
- [ ] 用 `@theme inline` 把 token 映射进 Tailwind 颜色命名空间
- [ ] 验证产物中 `bg-panel` 展开为 `var(--panel)`（确认深色模式自动继承，无需 `dark:` 变体）
- [ ] 验证产物中无 Preflight 规则注入
- [ ] 验证产物中无未使用的 Tailwind 默认主题变量

### P1 验收

- [ ] `npm run build` 通过，CSS 增量 ≤ +5 kB（raw）
- [ ] `npm test` 12 个用例通过
- [ ] `npm run lint` 无新增告警（基线 1 条）
- [ ] 浅色 / 深色两种模式下，两页视觉走查通过
- [ ] 订阅页表单提交、取消订阅、地点增删改手动验证无回归
- [ ] 详情页各状态（loading / ready / 404 / 503 / error）手动验证无回归

---

## P2 组件层

依赖：P0 的 D2 决策、P1 完成。

- [ ] 确定 `src/ui/` 对外 API（不暴露第三方库类型）
- [ ] Button
- [ ] Input
- [ ] Field（label + 校验提示）
- [ ] Select
- [ ] Switch
- [ ] Dialog
- [ ] Toast
- [ ] Collapse
- [ ] Badge
- [ ] ListItem
- [ ] 每个组件补单测
- [ ] 加 lint 规则 `no-restricted-imports`，禁止业务代码直接 import 第三方组件库

### P2 验收

- [ ] 业务代码无对第三方组件库的直接 import（由 lint 保证，非人工检查）
- [ ] 组件内无 `document` / `innerHTML` / `querySelector`
- [ ] 深色模式下各组件表现正确

---

## P3 同构准备

依赖：P1、P2 完成。**每一项对 Web 都独立有价值**，不是纯为小程序的投资。

### 订阅页 React 化（顺序按风险从低到高，不可打乱）

- [ ] `toast.ts` → React 组件（无业务状态，最安全的起点）
- [ ] `status.ts` → React 组件（只读 `/api/status`，不写 runtime 状态）
- [ ] `alerts.ts` → React 组件（状态集中在 `alerts_by_category`，边界清晰）
- [ ] `locations.ts` → React 组件（**最后做**，Leaflet 生命周期与状态机交织最深）
- [ ] 删除 `shell.html`
- [ ] 移除 `SubscribeRuntime` 与 `CleanupRegistry`
- [ ] 移除全部 `innerHTML` 拼接与 `escapeHtml` 调用点（React 自动转义）

### 平台适配层

- [ ] `src/platform/storage.ts` — 包装 `localStorage`，为 `Taro.setStorageSync` 留位
- [ ] `src/platform/request.ts` — 包装 `fetch`，为 `Taro.request` 留位
- [ ] `src/platform/navigate.ts` — 包装路由跳转
- [ ] `src/ui/map/` — 抽地图接口边界（`renderTargets()` / `fitBounds()` / `onPick()`），解开 Leaflet 与状态机耦合

### 顺带解决的既有问题

- [ ] 按路由代码分割，Leaflet 拆独立 chunk（当前单 chunk 459 kB；详情页用户不该下载订阅页工作区）
- [ ] 补 Error Boundary（当前渲染期异常直接白屏）
- [ ] 加 lint 规则禁止组件层裸 DOM API
- [ ] `IncidentPage` 的 `document.querySelector("#map-fit-button")` 改用 `useRef`

### P3 验收

- [ ] `src/subscribe/` 无命令式 DOM 模块
- [ ] 平台能力全部经适配层访问
- [ ] 详情页首屏 JS 显著小于当前 459 kB
- [ ] 全部既有测试通过，新组件有对应测试

---

## P4 接入小程序

**仅在下列前置条件全部满足后启动。**

### 前置条件

- [ ] P3 完成（订阅页已无 DOM 依赖）
- [ ] Q1 确认为企业/组织主体
- [ ] 类目审核可行性已确认
- [ ] React 19 与 Taro 的兼容路径已明确（官方支持落地，或决定降 React 18 / 用社区插件）

### 实施

- [ ] 接入 Taro + `weapp-tailwindcss`
- [ ] **只把订阅页做成小程序**
- [ ] **详情页保持 H5**（Bark 深链无法可靠拉起小程序）
- [ ] 地图补原生 `<map>` 实现
- [ ] 平台适配层补小程序实现

---

## 不做的事（明确排除，避免范围蔓延）

- 不为了「变好看」引入 shadcn/ui + Radix —— 依赖 DOM，与同构目标冲突（除非 Q1 使同构目标失效）
- 不现在引入 Taro —— 官方不支持 React 19，且换不来当下收益
- 不单独修复 token 覆盖缺陷 —— 会被 P1 的 token 统一覆盖，属重复工作
- 不在本轮优化地图渲染方案 —— 只抽边界
- 不整页重写订阅页 —— 按模块替换，保留测试护栏

---

## 进度

| 阶段 | 状态 | 阻塞项 |
| --- | --- | --- |
| P0 | 进行中 | Q1–Q5 待答复；NutUI spike 待做 |
| P1 | 未开始 | 等 Q2、Q5 |
| P2 | 未开始 | 等 D2 决策 |
| P3 | 未开始 | 等 P1、P2 |
| P4 | 未开始 | 等 P3 + Q1 + 类目审核 |

选型阶段做过的一次性 Tailwind PoC 已回退，当前仓库代码与 `main` 一致。
