# UI 技术栈选型与小程序同构可行性

目标：换掉现有观感、引入成熟轻量的 CSS 框架，并让代码之后能快速同构成微信小程序。

本文给出选型结论、支撑理由、**三个必须先解决的阻塞项**，以及分期路线。地图相关优化按要求暂缓，但第 6 节说明为什么现在就要给它留边界。

整体架构背景见 [architecture.md](architecture.md)；订阅页 DOM 层现状见 [subscribe-frontend.md](subscribe-frontend.md)。

---

## 1. 结论速览

| 决策项 | 结论 | 状态 |
| --- | --- | --- |
| CSS 框架 | **Tailwind CSS v4** + 官方 `@tailwindcss/vite` | 已落地并验证 |
| 设计 token | 收敛到 `src/styles/theme.css`，`@theme inline` 映射 | 已落地 |
| UI 组件库 | 收一层自有 `src/ui/` 适配层；同构选 NutUI React，纯 Web 可选 Arco / Ant Design | 待定，见第 4 节 |
| 小程序方案 | Taro，但**不是现在**接入 | 有阻塞项，见第 5 节 |
| 订阅页 React 化 | 从「可选优化」升级为**硬前置条件** | 见第 5.1 节 |
| 详情页进小程序 | **不建议**，保持 H5 | 见第 5.2 节 |
| 地图 | 暂缓优化，但现在就要抽适配边界 | 见第 6 节 |

一句话总结：**CSS 框架这件事没有争议，可以立刻做且零风险；小程序同构的难点不在选型，而在三个与框架无关的前置约束。**

---

## 2. 先纠正一个前提：现在的问题不是「没有 CSS 框架」

在动手之前我核查了现有样式，结论和「缺框架」不太一样。`subscribe.css` 已经有一套结构不错的体系：语义化 token、完整的深色模式、Apple HIG 风格调色板（`#f5f5f7` / `#0071e3`）。

也就是说，**换成 Tailwind 本身不会让页面变好看** —— Tailwind 是样式的书写机制，不是设计系统。把 `background: var(--panel)` 改写成 `bg-panel`，像素上不会有任何变化。

真正导致观感偏旧的是下面三件具体的事。它们都不需要等框架迁移完才能修：

### 2.1 字体栈以 Arial 开头

```4:6:src/styles/subscribe.css
    body {
      margin: 0;
      font-family: Arial, "Helvetica Neue", "MiSans", "PingFang SC", "Microsoft YaHei UI", "Noto Sans CJK SC", sans-serif;
```

Arial 排在首位，会盖掉 macOS / iOS 的 `-apple-system` 和 Windows 的 `Segoe UI`。Apple 风格的配色配 Arial 字形，是观感割裂的主要来源。**改这一行的收益可能大于整个框架迁移。**（`subscribe.css:438` 还有第二处 `font-family: Arial, sans-serif`，一并处理。）

新的 `theme.css` 里 `--font-sans` 已经给出建议栈（`-apple-system, BlinkMacSystemFont, "Segoe UI", "MiSans", "PingFang SC", …`），但没有动存量 CSS —— 这属于可见的视觉改动，留给你确认。

### 2.2 两个页面是两套互相冲突的设计语言

| | 订阅页 `subscribe.css` | 详情页 `detail.css` |
| --- | --- | --- |
| 主色 | `--primary: #0071e3`（Apple 蓝） | `--green: #176a56`（墨绿） |
| 背景 | `--bg: #f5f5f7` | `--paper: #f6f8f7` |
| 正文色 | `--text: #1d1d1f` | `--ink: #17211f` |
| 字体 | Arial 起头 | Inter 起头 |
| 深色模式 | 有 | **无** |

两套调色板没有任何共享，风格取向也不同（中性灰蓝 vs 森林绿）。这是「看起来不像一个产品」的根因。

### 2.3 而且这两套 token 正在互相覆盖（既有缺陷）

更严重的是：两个文件都在 `:root` 上声明 `--muted`、`--line`、`--panel`，**取值不同**。项目没有代码分割，Vite 把所有 CSS 打进同一个文件，因此两个 `:root` 始终同时生效、优先级相同，**后出现的那个全局胜出**。

我在改动前的基线产物上验证过：

```
--muted: #64716e   (detail.css 想要的)
--muted: #86868b   (subscribe.css 的，实际全局生效)
--line:  #d9e1de   (detail.css 想要的)
--line:  #d2d2d7   (subscribe.css 的，实际全局生效)
```

结果是**详情页一直在用订阅页的灰色渲染 `--muted` 和 `--line`**，而不是它自己设计的绿灰色。这不是我引入的，基线构建里就存在。

这个缺陷会在设计语言统一时自然消失，所以不建议单独打补丁 —— 那是会被丢掉的工作。但它说明「UI 丑」有确切的技术成因，不只是审美问题。

---

## 3. CSS 框架：为什么是 Tailwind v4 而不是 UnoCSS

你要求「成熟、轻量、快」。这两个候选都满足，但在**本项目的具体约束**下 Tailwind v4 明显更优。

### 3.1 已验证的事实

- 当前版本 **4.3.3**，`@tailwindcss/vite` 的 peer 依赖是 `vite: ^5.2.0 || ^6 || ^7 || ^8` —— 本项目是 Vite **8.2**，官方明确支持，不需要任何兼容层。
- Oxide（Rust）引擎：全量构建约 3.5–5x 快，增量构建 100x 以上，HMR 进入毫秒级。热路径完全绕过 PostCSS。
- CSS-first 配置，不再需要 `tailwind.config.js`。
- 生产 CSS 体积比 v3 小约 35%；构建内存占用大幅下降。

我在本仓库实测接入后：CSS 从 62.64 kB → 65.74 kB（gzip 16.75 → 17.43 kB），即 **+3.10 kB raw / +0.68 kB gzip**，且产物中**没有输出任何未使用的 Tailwind 默认主题变量**（实测统计为 0）。构建、12 个测试、lint 全部维持通过。

### 3.2 为什么不选 UnoCSS

UnoCSS 在纯 Web 场景确实更轻更快，但它在这个项目里的优势会被小程序这条约束抵消：

- 小程序支持来自社区预设 `unocss-preset-weapp`（单一维护者），不是官方能力。
- 该预设**明确不支持 React 版 Taro 的 Attributify 模式**，官方示例几乎都是 Vue。
- `box-shadow` 等含 `,`、`[` 的简写在原生小程序侧无法被 transformer 处理，只能手写 CSS 兜底。
- 反过来，唯一可用的「React 19 + 小程序」工具链（见 5.3）**内置的是 Tailwind v4**，不是 UnoCSS。

也就是说：选 Tailwind 能让 Web 与未来的小程序共用同一套样式方案；选 UnoCSS 则要在小程序侧额外赌一个社区预设。**在「之后要同构小程序」这个前提下，Tailwind 是风险更低的选择。**

### 3.3 落地时的一个关键取舍

完整的 `@import "tailwindcss"` 会连带引入 Preflight 基础重置，它会重置 margin、字号、标题样式等，**当场把存量手写页面搞乱**。所以接入层刻意只引入 theme 与 utilities：

```1:11:src/styles/theme.css
/*
 * Tailwind v4 接入层。
 *
 * 刻意不使用 `@import "tailwindcss"`：那会同时引入 Preflight 基础重置，
 * 与 subscribe.css / detail.css 里现有的手写样式冲突，导致存量页面立刻变样。
 * 这里只引入 theme 与 utilities，让原子类可以和存量 CSS 共存，按模块渐进替换。
 * 存量 CSS 全部删除后，再补回 `@import "tailwindcss/preflight.css" layer(base);`。
 */
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
```

配合 `@theme inline`，`bg-panel` 会在使用处直接展开成 `var(--panel)`（已在产物中验证），因此原子类**自动跟随现有的 `prefers-color-scheme` 翻转，不需要到处写 `dark:` 变体**。深色模式零成本继承。

这样就可以逐个模块替换样式，而不是一次性大爆改。

---

## 4. UI 组件库：同构需求大幅缩小了可选范围

这里有个容易踩的坑：**目前主流的 headless 组件库在小程序里全部不可用。**

Radix UI、Headless UI、Ark UI、shadcn/ui 都依赖 DOM API —— portal、`document` 上的事件、指向真实 DOM 节点的 ref、`getBoundingClientRect` 等。小程序没有 DOM，这些库一行都跑不起来。所以「用 shadcn 快速把 UI 变好看」和「之后同构小程序」是互斥的。

可选项收敛为三条：

| 方案 | 优点 | 风险 |
| --- | --- | --- |
| **A. NutUI React**（`@nutui/nutui-react-taro`） | 唯一成熟的「一套代码出 H5 + 小程序」React 组件库；70+ 组件；移动端视觉规范完整 | v4 仍是 beta（最新 `4.0.0-beta.6`，2026-08）；周下载量约 1.4K、star 约 1.2K，生态较小；228 个 open issue；**React 19 兼容性未经验证** |
| **B. 纯 Web 组件库**（Arco / Ant Design） | 成熟度与观感最好，立刻解决「丑」 | 完全无法同构，小程序侧要重写整个 UI 层 |
| **C. 基于 Tailwind 自建薄组件层** | 无第三方风险，完全可控，天然可移植 | 需要自己做设计决策与实现 |

**建议：以 A 为主，但必须包一层适配。**

关键动作是**不让第三方库的 API 泄漏到调用点**。所有组件通过自有的 `src/ui/` 层导出：

```
src/ui/
  Button.tsx      // 内部用 NutUI，对外暴露自己的 props
  Input.tsx
  Select.tsx
  Switch.tsx
  Dialog.tsx
  Toast.tsx
  Collapse.tsx
```

理由很实际：本项目的组件面其实很小 —— 按钮、输入框、下拉、开关、弹窗、提示、折叠面板、列表项、徽章，大约 10 个。这个规模下，适配层的成本很低，但换来两个重要性质：

1. NutUI 的 beta 状态或 React 19 不兼容一旦爆发，替换成本被限制在 `src/ui/` 内部，而不是散落在几十个调用点。
2. 方案 C 随时可以作为逐组件的退路 —— 哪个组件 NutUI 不合适，就在适配层里换成自己实现，调用方无感。

这也是唯一能同时满足「用开源框架」和「不把项目绑死在一个 beta 库上」的做法。

---

## 5. 小程序同构：三个阻塞项

选型不是难点。下面三条才是，而且**都不是换框架能解决的**。

### 5.1 订阅页必须先完成 React 化（硬前置）

小程序没有 DOM。而订阅页当前的实现方式恰好全部依赖 DOM：

| 现状 | 小程序可用性 |
| --- | --- |
| `shell.html?raw` 经 `innerHTML` 注入 | 不可用 |
| `querySelector` 查询 52 个节点 | 不可用 |
| `document.createElement` / `addEventListener` | 不可用 |
| `escapeHtml` + 字符串模板拼 HTML（7 处） | 不可用 |
| Leaflet 直接操作 DOM | 不可用 |

Taro 为 React 提供的是组件运行时，**不是 DOM 模拟层** —— 你可以写 React 组件，但不能注入 HTML 字符串。

这意味着 `docs/subscribe-frontend.md` 里那条「逐模块替换成 React」的计划，从**可选优化变成了小程序的硬前置条件**。约 1100 行命令式代码（`alerts.ts` 593 + `locations.ts` 550）必须先变成组件。

好消息是这条路线已经规划好且有测试护栏，顺序也已确定：`toast.ts` → `status.ts` → `alerts.ts` → `locations.ts`。小程序目标只是把它的优先级提前。

### 5.2 Bark 深链无法进入小程序（产品级阻塞）

这一条最容易被忽略，但它直接决定详情页能不能迁。

详情页的唯一正常入口是 Bark 推送里的 `https://…/incidents/:id/notifications/:token` 深链。Bark 是 iOS 推送，点击后在浏览器里打开 URL。**任意 HTTPS URL 无法直接拉起微信小程序。** 微信官方的 URL Scheme 能力有一串硬限制：

- **仅支持非个人主体的小程序** —— 如果是个人开发者账号，这条路直接不通。
- Android **不支持**直接识别 URL Scheme，必须再加一个 H5 中转页。
- 跳转时可能触发系统弹框询问，用户可以拒绝。
- 只能指向**已发布**的小程序页面。
- 有每日打开次数上限与防刷风控。
- 社区反馈部分较新 iOS 机型上明文 Scheme 点击后完全无响应。

对一个**灾害预警**产品来说，「推送点开后可能打不开」是不能接受的失败模式 —— 恰恰在最需要送达的时刻掉链子。

**建议：详情页保持 H5，不迁小程序。** 小程序只承载订阅配置。真要让详情页进小程序，就得把通知通道从 Bark 换成微信订阅消息，那是产品层面的改造（需要小程序 appid、类目资质、消息模板审核），远超 UI 重构的范围。

### 5.3 React 19 与 Taro 官方不兼容

- Taro 最新稳定版 **4.2**（2026-04），官方文档只覆盖到 **React 18**；React 19 的支持 issue（#18329）**至今仍 open**。
- 唯一的 React 19 路径是社区插件 `vite-plugin-taro`（Vite 8 + React 19 + Tailwind v4）。方向很对，但它是单人维护的社区项目，使用者反馈「虽然还有不少问题，但至少解决了有无的问题」。

本项目现在是 React **19.2**。所以真正接入小程序时只有两个选择：

| 选择 | 代价 |
| --- | --- |
| 降到 React 18 走 Taro 官方链路 | 放弃 React 19 特性；主干要降级 |
| 赌社区 `vite-plugin-taro` | 官方支持缺位，踩坑自负；但能保留 React 19 + Vite 8 + Tailwind v4 |

**这个决定不需要现在做。** 等订阅页 React 化完成（5.1）再评估，届时 Taro 对 React 19 的官方支持很可能已经落地，赌注自然消失。这也是下一节主张「按可同构来设计，但先别上 Taro」的核心理由。

### 5.4 另外提醒一件非技术的事

微信小程序上架需要过类目审核。本项目发布的是**灾害/地震预警**信息，在国内属于受监管内容 —— 项目自己的 `TermsDialog` 就已经写明「部署者应自行核查适用法律法规，并取得所需许可、数据授权」。小程序审核大概率会要求相应资质证明，个人主体基本无法通过。

这不影响技术选型，但**值得在投入 UI 重构之前先确认**，否则可能出现技术都做完了却上不了架的情况。

---

## 6. 地图：暂缓优化，但现在就留边界

按你的要求不做地图方案优化。不过有一点现在就要处理，成本极低：

Leaflet 在小程序里**完全不可用**（依赖 DOM 与 `<canvas>` 的 Web 实现），小程序侧必须换成原生 `<map>` 组件（腾讯地图底图）。这是唯一一块**无法同构、只能双实现**的功能。

所以建议现在只做一件事：**把地图收进一个接口边界后面**，例如 `src/ui/map/` 暴露 `renderTargets()` / `fitBounds()` / `onPick()` 这类语义化能力，而不是让 Leaflet 的 API 散布在业务代码里。当前 `locations.ts` 里 Leaflet 调用与地点状态机是交织的，这也正是它在 React 化顺序里排最后的原因。

抽出边界后，未来只需要为小程序补一个 `<map>` 实现，业务逻辑不用改。**不抽的话，地图会成为整个同构方案的死结。**

---

## 7. 建议路线

核心策略：**按「可同构」来设计，但不要现在就引入 Taro。**

原因是风险隔离。现在上 Taro 意味着把整个 Web 应用押在一个「官方不支持 React 19 + 社区插件仍有问题」的工具链上，而这么做换不来任何**当下**的收益 —— 你现在想要的是页面变好看。把这两件事解耦，就能立刻拿到 UI 收益，同时不为小程序背上工具链风险。

### 第一阶段：立刻可做，零同构风险

1. ~~接入 Tailwind v4~~（已完成并验证）
2. 修字体栈 —— 一行改动，视觉收益最高（2.1 节）
3. 统一两页设计语言，顺带消掉 token 覆盖缺陷（2.2 / 2.3 节）
4. 搭 `src/ui/` 适配层，先用 Tailwind 自建，把组件 API 定下来

到这里「UI 丑」基本解决，且没有任何一步依赖小程序方案落地。

### 第二阶段：为同构做准备（每步都对 Web 独立有价值）

5. 按既定顺序完成订阅页 React 化，先 `toast`，再 `status`，然后 `alerts`，最后 `locations`
6. 把平台相关能力收进适配层（明细见下表）
7. 约束：组件层不出现裸 DOM API（`document`、`innerHTML`、`querySelector`）。可以加 lint 规则机制化保证，而不是靠人工纪律

第 6 步要抽象的四项能力：

| 能力 | Web 实现 | 小程序实现 |
| --- | --- | --- |
| 存储 | `localStorage` | `Taro.setStorageSync` |
| 请求 | `fetch` | `Taro.request` |
| 路由 | react-router | Taro pages 配置 |
| 地图 | Leaflet | 原生 `<map>` 组件 |

### 第三阶段：真正接小程序（前置条件满足后再启动）

8. 确认主体资质与类目审核可行（5.4）
9. 决定 React 18 降级 vs 社区插件（5.3）—— 届时官方可能已支持，问题自动消失
10. 只把订阅页做成小程序；详情页保持 H5（5.2）

### 一个附带收益

第二阶段的第 6 步会顺带解决 `architecture.md` 第 11 节的风险 4（无代码分割）：把地图和详情页拆成独立 chunk，从 Bark 深链进来的用户就不必再下载整个订阅页工作区。目前产物是单个 459 kB 的 chunk。

---

## 8. 待你确认的问题

技术选型的部分我已经给出结论并验证了基础设施，但下面几个需要你的输入才能继续：

1. **视觉风格取向** —— 统一到哪一套？订阅页的中性灰蓝（Apple 风）、详情页的墨绿，还是重新定？这决定第一阶段第 3 步怎么做。
2. **移动端优先级** —— 既然目标是小程序，UI 是否应该直接按移动优先重做？这会影响组件库选择（NutUI 是移动端规范，桌面端观感一般）。
3. **小程序主体** —— 个人还是企业/组织？这一条直接决定 5.2 和 5.4 是否可行，进而决定整个同构目标要不要调整。
4. **字体栈** —— 是否现在就改（2.1）？这是唯一会立刻改变现有观感的改动，我没有擅自动。

其中第 3 条建议优先确认。如果是个人主体，小程序这条路的可行性需要重新评估，第二阶段的取舍也会跟着变。
