# 技术设计文档：UI 技术栈选型

**状态：待评审。本文不含任何代码改动，评审通过后才进入实施。**

配套文档：实施计划见 [ui-redesign-plan.md](ui-redesign-plan.md)，任务清单见 [ui-redesign-todo.md](ui-redesign-todo.md)，仓库现状见 [architecture.md](architecture.md)。

---

## 1. 需求与约束

### 1.1 需求（来自沟通）

1. 现有页面观感偏旧，需要改善。
2. 引入一个**成熟、轻量、快速**的 CSS 框架（现在没有）。
3. 引入开源 UI 框架，不完全手写组件。
4. **之后要能快速同构成微信小程序。**
5. 地图优化暂缓。

### 1.2 硬约束（来自仓库现状）

| 约束 | 数值 / 说明 |
| --- | --- |
| 构建链路 | Vite 8.2 + TypeScript ~6.0 |
| React 版本 | 19.2 |
| 存量手写 CSS | `subscribe.css` 814 行 + `detail.css` 39 行 = 853 行 |
| 订阅页渲染范式 | 命令式 DOM（`shell.html?raw` + `innerHTML`），非 React 组件树 |
| 现有 token 体系 | 已有语义化 token + 完整深色模式（`prefers-color-scheme`） |
| 测试护栏 | 4 个文件 12 个用例 |
| 构建产物 | 单 chunk，JS 459 kB / CSS 62.64 kB |

### 1.3 非目标

- 不在本轮解决地图方案（但需留出边界，见 6.3）。
- 不在本轮引入状态管理库（现有状态规模不需要）。
- 不在本轮做 SSR / SEO（详情页刻意 `noindex`）。

---

## 2. 先修正一个前提：问题不是「没有 CSS 框架」

需求 2 的表述是「没有引入 CSS 框架，也要引入一个」。但核查存量样式后，我认为这个因果关系需要修正 —— 否则会选错要解决的问题。

`subscribe.css` 已经具备一套结构合理的样式体系：

- 16 个语义化 token（`--bg` / `--panel` / `--text` / `--muted` / `--line` / `--primary` + 4 组状态色）
- 完整的 `prefers-color-scheme: dark` 深色模式
- Apple HIG 风格调色板（`#f5f5f7` 背景、`#0071e3` 主色）

**换成任何 CSS 框架，本身都不会让页面变好看。** Tailwind / UnoCSS / Panda 都是样式的**书写机制**，不是设计系统。把 `background: var(--panel)` 改写成 `bg-panel`，渲染结果逐像素相同。

那么「丑」的实际来源是什么？我定位到三条具体成因，它们都不需要等框架迁移完成才能修复。

### 2.1 字体栈以 Arial 开头

```38:40:src/styles/subscribe.css
    body {
      margin: 0;
      font-family: Arial, "Helvetica Neue", "MiSans", "PingFang SC", "Microsoft YaHei UI", "Noto Sans CJK SC", sans-serif;
```

Arial 位于首位，会优先命中并盖掉 macOS / iOS 的 `-apple-system` 与 Windows 的 `Segoe UI`。Apple 风格的配色搭配 Arial 字形，是观感割裂最直接的来源。`subscribe.css:472` 还有第二处 `font-family: Arial, sans-serif`。

**这两行的视觉收益，很可能高于整个框架迁移。** 建议作为独立的、可单独验证的改动优先处理。

### 2.2 两个页面是两套互相冲突的设计语言

| 维度 | 订阅页 `subscribe.css` | 详情页 `detail.css` |
| --- | --- | --- |
| 主色 | `--primary: #0071e3`（Apple 蓝） | `--green: #176a56`（墨绿） |
| 背景 | `--bg: #f5f5f7` | `--paper: #f6f8f7` |
| 正文色 | `--text: #1d1d1f` | `--ink: #17211f` |
| 字体首选 | Arial | Inter |
| 深色模式 | 有 | **无** |

两套调色板没有任何共享，风格取向也相反（中性灰蓝 vs 森林绿）。这是「看起来不像同一个产品」的根因，也是本轮最值得投入的一项。

### 2.3 而且这两套 token 正在互相覆盖（既有缺陷）

更严重的是：两个文件都在 `:root` 上声明 `--muted`、`--line`、`--panel`，**取值不同**。项目没有代码分割，Vite 把全部 CSS 打进同一个文件，因此两个 `:root` 始终同时生效、选择器优先级相同，**在源码顺序中靠后的那个全局胜出**。

在改动前的基线产物上实测：

| token | `detail.css` 意图值 | 实际全局生效值 |
| --- | --- | --- |
| `--muted` | `#64716e`（绿灰） | `#86868b`（订阅页的中性灰） |
| `--line` | `#d9e1de`（绿灰） | `#d2d2d7`（订阅页的中性灰） |

即**详情页一直在用订阅页的灰色渲染这两个 token**，而非它自己设计的绿灰色。这是既有缺陷，不是本轮引入的。

它会在 2.2 的设计语言统一中自然消失，因此不建议单独打补丁 —— 那是会被丢弃的工作。但它证明「UI 丑」有确切的技术成因，不只是审美偏好问题。

### 2.4 对结论的影响

因此本轮真正要交付的是**统一的设计系统**，CSS 框架只是承载它的机制。选型仍然要做（它决定后续可维护性和小程序同构路径），但不应期待「换框架 = 变好看」。

---

## 3. 评估标准

按本项目的实际权重排序。权重来自第 1 节的需求与约束，不是通用排序。

| # | 标准 | 权重 | 依据 |
| --- | --- | --- | --- |
| C1 | **小程序可同构性** | 最高 | 需求 4 明确要求；且这是唯一会**否决**候选的标准 |
| C2 | 成熟度与维护活跃度 | 高 | 需求 2 明确要求「成熟」 |
| C3 | 渐进接入能力 | 高 | 853 行存量 CSS 无法一次性重写 |
| C4 | 体积与构建性能 | 中高 | 需求 2 明确要求「轻量、快速」 |
| C5 | Vite 8 / React 19 兼容 | 中高 | 不兼容则需改动构建链路或降级 |
| C6 | token 与深色模式支持 | 中 | 需承接 2.1–2.3 的设计系统统一 |
| C7 | 学习曲线 | 低 | 单人项目，可控 |

**C1 是决定性的。** 它把「纯 Web 场景下谁更优」这个问题变成了「谁在小程序侧有可靠的适配路径」。这也是我这次结论与「按纯 Web 直觉选型」不同的原因。

---

## 4. CSS 框架候选分析

### 4.1 候选清单

纳入评估的 7 个方案，覆盖原子化 CSS、编译时 CSS-in-JS、作用域 CSS 三类范式：

Tailwind CSS v4、UnoCSS、Panda CSS、StyleX、vanilla-extract、CSS Modules、保持手写 CSS（现状基线）。

### 4.2 决定性维度：小程序适配现状

小程序（WXSS）与浏览器 CSS 有几处硬差异，直接决定候选可行性：

- 类名中的 `\`、`:`、`[`、`.`、`/`、`#` 等转义字符**不支持** —— 而原子化 CSS 恰好大量产生这类类名（`bg-[#fff]`、`hover:bg-red`、`w-1/2`）。
- 不支持 `@layer` 级联层。
- 尺寸单位是 `rpx`，需要 `px`/`rem` → `rpx` 转换。
- 部分选择器（`*`、`:root`、`:not()` 的某些形式）受限。

所以**任何 CSS 方案要进小程序，都必须有一个转换层**。各候选的转换层现状实测如下：

| 方案 | 小程序适配方案 | 适配层成熟度信号 |
| --- | --- | --- |
| **Tailwind v4** | `weapp-tailwindcss` | **v5.3.4；2K star；周下载 7.8K；2026-08-22 仍在更新；被 Taro 官方文档收录为推荐做法**；支持 Vite/Webpack/Rspack/Rollup/Gulp；覆盖微信/支付宝/字节等多端 |
| UnoCSS | `unocss-preset-weapp` | 社区单人维护；**明确不支持 React 版 Taro 的 Attributify 模式**；官方示例几乎全是 Vue；`box-shadow` 等含 `,`/`[` 的简写无法被 transformer 处理，只能手写兜底 |
| Panda CSS | `weapp-pandacss` | **仅 17 star**；需额外装 `@csstools/postcss-cascade-layers` 处理 `@layer`；生成的 `cva.mjs` 用了小程序不支持的可选链，需 babel 或「编译成 ES5」兜底 |
| StyleX | **无** | 无社区适配生态 |
| vanilla-extract | **无** | 无社区适配生态 |
| CSS Modules | **Taro 内置** | 官方内置支持（默认关闭，`cssModules.enable` 开启）；成熟度最高，但只解决作用域，不提供设计系统 |
| 手写 CSS（现状） | 可直接用 | 无需适配层，但也拿不到任何设计系统收益 |

这一项直接淘汰 **StyleX** 和 **vanilla-extract** —— 无论它们在 Web 侧多优秀，选了就等于放弃需求 4。

**这里修正我此前的一个判断。** 我先前把 Tailwind 与 UnoCSS 的小程序支持描述得较为接近，实际差距很大：`weapp-tailwindcss` 有 2K star、周下载 7.8K、且**写进了 Taro 官方文档**；`unocss-preset-weapp` 是单人维护且对 React 版 Taro 有已知功能缺失。Tailwind 在 C1 上是明显优势，不是微弱领先。

### 4.3 逐个分析

#### Tailwind CSS v4 —— 推荐

**C1 小程序**：最强。`weapp-tailwindcss` 是事实标准，且 Taro 官方文档直接推荐（`docs.taro.zone/docs/tailwindcss`）。支持 Tailwind v4。

**C2 成熟度**：最高。生态规模、文档、招聘熟悉度都是第一梯队。

**C3 渐进接入**：好，但**有一个必须处理的坑**。完整的 `@import "tailwindcss"` 会连带引入 Preflight 基础重置（重置 margin、字号、标题样式等），会当场破坏 853 行存量手写样式。解决办法见 6.1 —— 只引入 theme 与 utilities 层，跳过 Preflight。

**C4 体积与性能**：v4 的 Oxide（Rust）引擎，全量构建约 3.5–5x 快，增量构建 100x 以上，HMR 进入毫秒级；热路径完全绕过 PostCSS；生产 CSS 体积比 v3 小约 35%。

**C5 兼容性**：`@tailwindcss/vite@4.3.3` 的 peer 依赖为 `vite: ^5.2.0 || ^6 || ^7 || ^8`，本项目 Vite 8.2 **官方支持**，无需兼容层。与 React 版本无关。

**C6 token**：v4 的 CSS-first 配置（`@theme`）天然适配现有 CSS 变量体系，见 6.1 的映射方案。

**风险**：v4 要求 Safari 16.4+ / Chrome 111+ / Firefox 128+。灾害预警场景下的老旧 Android 设备需评估 —— 见 8.1。另外 `weapp-tailwindcss@5.2.0+` 要求 Node ≥ 22.12.0（本仓库 Dockerfile 用 `node:22-bookworm`，满足）。

#### UnoCSS —— 否决

纯 Web 场景下它确实更轻更快，按通用直觉应该选它。但在 C1 上劣势明确：适配预设单人维护、**对 React 版 Taro 有已知功能缺失**、示例生态偏 Vue。

更关键的是方向一致性：唯一可用的「React 19 + 小程序」工具链（见 5.3）内置的是 Tailwind v4，不是 UnoCSS。选 UnoCSS 意味着在小程序侧额外承担一个社区预设的风险，换来的只是 Web 侧边际的体积优势 —— 在 v4 的 Oxide 引擎把性能差距大幅收窄之后，这笔交易不划算。

#### Panda CSS —— 否决

编译时 CSS-in-JS，类型安全和 DX 都很好。但 `weapp-pandacss` 仅 17 star，且有多处需要手动兜底的摩擦（`@layer` 需额外 postcss 插件、生成代码用了小程序不支持的可选链）。对一个需要长期维护的项目，把同构路径押在这个适配层上风险过高。

#### StyleX / vanilla-extract —— 否决

无小程序适配生态。选它们等于放弃需求 4。

#### CSS Modules —— 保留为退路

Taro 内置支持，成熟度最高，风险最低。但它只解决**样式作用域**，不提供设计 token、间距体系、响应式断点或工具类 —— 也就是说，它不解决第 2 节诊断出的真实问题（设计系统缺失）。

**定位**：如果 Tailwind 在小程序侧出现无法绕过的问题，CSS Modules 是可靠退路。但不作为首选。

#### 保持手写 CSS —— 否决

不引入任何机制，2.2 / 2.3 的问题只能靠人工纪律维持一致性 —— 而 2.3 的 token 覆盖缺陷恰好证明了人工纪律已经失效。

### 4.4 对比矩阵

评级：`++` 优 / `+` 良 / `○` 中 / `-` 差 / `✗` 否决项。

| 方案 | C1 小程序 | C2 成熟度 | C3 渐进接入 | C4 体积性能 | C5 Vite8/R19 | C6 token | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Tailwind v4** | **++** | **++** | **+**（需跳过 Preflight） | **++** | **++** | **++** | **采用** |
| UnoCSS | ○（React Taro 有缺失） | + | + | ++ | ++ | ++ | 否决 |
| Panda CSS | -（17 star，多处摩擦） | ○ | + | + | + | ++ | 否决 |
| StyleX | ✗ 无适配 | + | ○ | + | ○（需 babel） | + | 否决 |
| vanilla-extract | ✗ 无适配 | + | + | + | + | + | 否决 |
| CSS Modules | ++（Taro 内置） | ++ | ++ | ○ | ++ | -（不提供） | 退路 |
| 手写 CSS（现状） | ++ | — | ++ | ○ | ++ | -（已失效） | 否决 |

### 4.5 结论

**采用 Tailwind CSS v4 + 官方 `@tailwindcss/vite`。**

决策依据的优先级是：C1（小程序可同构性）→ C2（成熟度）→ C4（性能）。Tailwind 在这三项上同时领先，且是唯一在 C1 上有**官方文档背书的适配路径**的方案。

需要明确记录的取舍：**在纯 Web 视角下 UnoCSS 更轻更快，我们主动放弃了这部分边际收益，换取小程序同构路径的可靠性。** 如果需求 4（小程序）被取消，这个结论应当重新评估。

### 4.6 PoC 验证结果

为降低选型风险，我做过一次一次性验证（**代码已回退，不在本次评审范围内**）。实测数据：

| 指标 | 基线 | 接入 Tailwind 后 | 增量 |
| --- | --- | --- | --- |
| CSS | 62.64 kB / gzip 16.75 kB | 65.74 kB / gzip 17.43 kB | +3.10 kB / gzip +0.68 kB |
| JS | 459.39 kB | 459.39 kB | 0 |
| 模块数 | 44 | 45 | +1 |
| 测试 | 12 通过 | 12 通过 | 无退化 |
| lint | 1 warning | 1 warning | 无新增 |

另外验证了三件事：

1. `@tailwindcss/vite` 与 Vite 8.2 直接协作，无需任何兼容配置。
2. 跳过 Preflight 后，存量样式**完全未受影响**（产物中确认无 Tailwind 基础重置规则）。
3. `@theme inline` 方案生效：`bg-panel` 在产物中展开为 `background-color:var(--panel)`，因此原子类自动跟随现有 `prefers-color-scheme` 翻转，**无需逐元素写 `dark:` 变体**。
4. 产物中**未输出任何未使用的 Tailwind 默认主题变量**（实测统计为 0），即 tree-shaking 正常。

结论：技术路径已验证可行，剩下的是设计决策而非技术风险。

---

## 5. UI 组件库候选分析

### 5.1 一个会淘汰大半候选的约束

**主流 headless 组件库在小程序中全部不可用。**

Radix UI、Headless UI、Ark UI、以及基于它们的 shadcn/ui，都依赖：portal（渲染到 `document.body`）、`document` 级事件、指向真实 DOM 节点的 ref、`getBoundingClientRect` 等测量 API。小程序没有 DOM，这些能力一个都不具备。

这意味着一个需要明确的取舍：**「用 shadcn 快速把 UI 变好看」与「之后同构小程序」是互斥的。** 必须先确认需求 4 的优先级，才能选组件库 —— 这也是第 9 节把「小程序主体资质」列为最优先确认项的原因。

### 5.2 候选对比

| 方案 | 同构能力 | 成熟度信号 | 视觉质量 | 风险 |
| --- | --- | --- | --- | --- |
| **NutUI React**（`@nutui/nutui-react-taro`） | **是**（H5 + 小程序一套代码） | 70+ 组件；但 v4 仍 beta（`4.0.0-beta.6`，2026-08）；周下载约 1.4K；star 约 1.2K；228 open issues | 京东移动端规范，移动端好、桌面端一般 | **React 19 兼容性未验证**；生态较小 |
| @antmjs/vantui | 是（Vant for Taro React） | 社区移植，规模小于 NutUI | Vant 风格，移动端成熟 | 维护体量小 |
| Taro UI | 是 | 老牌但活跃度已低 | 偏旧 | 维护风险 |
| Arco / Ant Design | **否** | 极高 | 高（桌面端） | 无法同构，小程序侧需重写整个 UI 层 |
| shadcn/ui + Radix | **否**（依赖 DOM） | 高 | 高，且高度可定制 | 与需求 4 直接冲突 |
| 自建（基于 Tailwind） | **是**（只要不碰裸 DOM API） | — | 取决于投入 | 需自行做设计决策 |

### 5.3 结论：组件库收在自有适配层之后

**推荐：以 NutUI React 为主要实现，但强制通过自有 `src/ui/` 适配层对外暴露。**

理由是风险隔离。NutUI 是唯一成熟的「一套代码出 H5 + 小程序」的 React 组件库，但它 v4 仍处 beta、周下载量仅约 1.4K、且 **React 19 兼容性未经验证**。直接在几十个调用点引用它的 API，一旦出问题，替换成本会失控。

本项目的组件面其实很小 —— 按钮、输入框、下拉、开关、弹窗、提示、折叠面板、列表项、徽章，约 10 个。这个规模下适配层成本很低，却换来两个关键性质：

1. 第三方库的 beta 状态或版本不兼容一旦爆发，改动被限制在 `src/ui/` 内部。
2. 「自建」方案随时可作为**逐组件**退路 —— 某个组件 NutUI 不合适，就在适配层里换成自己实现，调用方无感知。

这是唯一能同时满足「用开源框架」（需求 3）和「不把项目押在一个 beta 库上」的做法。

**注意**：NutUI 的 React 19 兼容性必须在实施前用一次性 spike 验证，这是本方案最大的未知项。见 [ui-redesign-plan.md](ui-redesign-plan.md) 的 P0 决策点。

---

## 6. 架构设计

### 6.1 样式层：跳过 Preflight + `@theme inline`

两个关键设计点，均已在 4.6 的 PoC 中验证。

**(1) 只引入 theme 与 utilities，跳过 Preflight**

```
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
```

而不是 `@import "tailwindcss"`。后者会引入 Preflight 基础重置，破坏 853 行存量手写样式。跳过它，原子类就能与存量 CSS 共存，支持按模块渐进替换（满足 C3）。存量 CSS 全部删除后，再补回 `@import "tailwindcss/preflight.css" layer(base);`。

**(2) 用 `@theme inline` 承接现有 token**

基础 token 保留为唯一真相源（随 `prefers-color-scheme` 翻转），再用 `@theme inline` 映射进 Tailwind 的颜色命名空间：

```
@theme inline {
  --color-panel: var(--panel);
  --color-fg: var(--text);
  ...
}
```

`inline` 的作用是让 Tailwind 在**使用处**直接展开 `var(--panel)`，而不是再套一层间接引用。效果是 `bg-panel` 等原子类自动跟随现有的深色模式媒体查询，**不需要在每个元素上写 `dark:` 变体** —— 深色模式零成本继承（满足 C6）。

### 6.2 组件层：`src/ui/` 适配层

```
src/ui/
  Button.tsx      内部用 NutUI，对外暴露自有 props
  Input.tsx
  Select.tsx
  Switch.tsx
  Dialog.tsx
  Toast.tsx
  Collapse.tsx
  Badge.tsx
  ListItem.tsx
```

约束：**业务代码只从 `src/ui/` 导入，不直接 import NutUI。** 可用 lint 规则（如 `no-restricted-imports`）机制化保证，而不是靠人工纪律 —— 2.3 的 token 覆盖缺陷已经说明人工纪律不可靠。

### 6.3 平台适配层：为同构预留边界

小程序与 Web 在四项能力上实现不同。现在就把它们收到边界后面，成本极低；不收的话，同构时要在业务代码里到处改。

| 能力 | Web 实现 | 小程序实现 | 建议边界 |
| --- | --- | --- | --- |
| 存储 | `localStorage` | `Taro.setStorageSync` | `src/platform/storage.ts` |
| 请求 | `fetch` | `Taro.request` | `src/platform/request.ts` |
| 路由 | react-router | Taro pages 配置 | `src/platform/navigate.ts` |
| 地图 | Leaflet | 原生 `<map>` 组件 | `src/ui/map/` |

**地图是唯一无法同构、只能双实现的功能。** Leaflet 依赖 DOM 与 Web canvas，小程序侧必须换成腾讯地图底图的原生 `<map>`。

按要求本轮不优化地图方案，但**建议现在就抽出接口边界**（例如暴露 `renderTargets()` / `fitBounds()` / `onPick()` 这类语义化能力），而不是让 Leaflet 的 API 散落在业务代码里。目前 `locations.ts` 中 Leaflet 调用与地点状态机深度交织，这也正是它在 React 化顺序里排最后的原因。**不抽边界的话，地图会成为整个同构方案的死结。**

---

## 7. 小程序同构：三个阻塞项

选型不是难点。以下三条才是，且**都不是换框架能解决的**。

### 7.1 订阅页必须先完成 React 化（硬前置）

小程序没有 DOM。而订阅页当前实现恰好全部依赖 DOM：

| 现状 | 小程序可用性 |
| --- | --- |
| `shell.html?raw` 经 `innerHTML` 注入 | 不可用 |
| `querySelector` 查询 52 个节点 | 不可用 |
| `document.createElement` / `addEventListener` | 不可用 |
| `escapeHtml` + 字符串模板拼 HTML（7 处） | 不可用 |
| Leaflet 直接操作 DOM | 不可用 |

Taro 为 React 提供的是**组件运行时，不是 DOM 模拟层** —— 可以写 React 组件，但不能注入 HTML 字符串。

因此 [subscribe-frontend.md](subscribe-frontend.md) 里那条「逐模块替换成 React」的计划，**从可选优化变成了小程序的硬前置条件**。约 1143 行命令式代码（`alerts.ts` 593 + `locations.ts` 550）必须先变成组件。

好消息：这条路线已规划且有测试护栏，顺序也已确定 —— 先 `toast`，再 `status`，然后 `alerts`，最后 `locations`。小程序目标只是把它的优先级提前。

### 7.2 Bark 深链无法可靠进入小程序（产品级阻塞）

这一条最容易被忽略，但它直接决定详情页能不能迁。

详情页的唯一正常入口是 Bark 推送中的 `https://…/incidents/:id/notifications/:token` 深链。Bark 是 iOS 推送，点击后在浏览器打开 URL。**任意 HTTPS URL 无法直接拉起微信小程序。** 微信官方 URL Scheme 能力有一串硬限制：

- **仅支持非个人主体的小程序** —— 个人开发者账号直接不通。
- Android **不支持**直接识别 URL Scheme，必须再加 H5 中转页。
- 跳转可能触发系统弹框询问，用户可以拒绝。
- 只能指向**已发布**的小程序页面。
- 有每日打开次数上限与防刷风控。
- 社区反馈部分较新 iOS 机型上明文 Scheme 点击后完全无响应。

对**灾害预警**产品来说，「推送点开后可能打不开」是不可接受的失败模式 —— 恰恰在最需要送达的时刻失效。

**建议：详情页保持 H5，不迁小程序。小程序只承载订阅配置。** 若要让详情页进小程序，需把通知通道从 Bark 换成微信订阅消息 —— 那是产品层面改造（需小程序 appid、类目资质、消息模板审核），远超 UI 重构范围。

### 7.3 Taro 官方不支持 React 19

- Taro 最新稳定版 **4.2**（2026-04），官方文档只覆盖到 **React 18**；React 19 支持 issue（#18329）**至今仍 open**。
- 唯一的 React 19 路径是社区插件 `vite-plugin-taro`（Vite 8 + React 19 + Tailwind v4）。方向正确，但单人维护，使用者反馈「虽然还有不少问题，但至少解决了有无的问题」。

本项目现在是 React **19.2**。真正接入小程序时只有两个选择：

| 选择 | 代价 |
| --- | --- |
| 降到 React 18 走 Taro 官方链路 | 放弃 React 19 特性；主干需降级 |
| 用社区 `vite-plugin-taro` | 官方支持缺位，踩坑自负；但保留 React 19 + Vite 8 + Tailwind v4 |

**这个决定不需要现在做。** 等 7.1 完成后再评估，届时 Taro 对 React 19 的官方支持很可能已落地，赌注自然消失。这是第 8 节主张「按可同构设计，但先别上 Taro」的核心理由。

### 7.4 一个非技术的前置确认

微信小程序上架需过类目审核。本项目发布**灾害/地震预警**信息，在国内属受监管内容 —— 项目自己的 `TermsDialog` 已写明「部署者应自行核查适用法律法规，并取得所需许可、数据授权」。小程序审核大概率要求相应资质证明，**个人主体基本无法通过**。

这不影响技术选型，但**必须在投入 UI 重构之前确认**，否则可能出现技术全部完成却无法上架的情况。

---

## 8. 关键策略：按可同构设计，但先不引入 Taro

核心主张：**现在不要引入 Taro。**

理由是风险隔离。现在上 Taro 意味着把整个 Web 应用押在一个「官方不支持 React 19 + 社区插件仍有已知问题」的工具链上，而这么做**换不来任何当下收益** —— 当前诉求是页面变好看（需求 1–3），不是立刻上线小程序。

把两件事解耦，就能立刻拿到 UI 收益，同时不为小程序背上工具链风险。具体做法是**按「可同构」约束来设计**：

1. 样式方案选小程序侧有可靠适配的（Tailwind，见 4.5）。
2. 组件不依赖裸 DOM API（`document` / `innerHTML` / `querySelector`），用 lint 机制化。
3. 平台相关能力收进适配层（6.3）。
4. 组件库收在自有 `src/ui/` 之后（5.3）。

满足这四条，未来接 Taro 时业务代码几乎不用改。

### 8.1 需要单独评估的一项风险

Tailwind v4 要求 **Safari 16.4+ / Chrome 111+ / Firefox 128+**（依赖 `@property`、`color-mix()`、级联层等现代 CSS 特性）。

灾害预警产品的用户设备分布可能包含较老的 Android 机型。**建议在实施前确认目标用户的浏览器版本分布。** 若老设备占比不可忽略，需要评估降级方案（Tailwind v3，或 CSS Modules 退路）。这是 Tailwind 方案唯一的实质性风险，也是第 9 节的待确认项之一。

---

## 9. 待确认事项

技术选型部分我已给出结论并验证了可行性，但以下需要你的输入才能进入实施：

| # | 问题 | 阻塞什么 | 优先级 |
| --- | --- | --- | --- |
| Q1 | **小程序主体是个人还是企业/组织？** | 决定 7.2 与 7.4 是否可行，进而决定整个同构目标是否成立 —— 若为个人主体，需求 4 可能需要重新定义，5.1 的组件库取舍也会翻转 | **最高** |
| Q2 | 视觉风格取向：统一到订阅页的 Apple 灰蓝、详情页的墨绿，还是重新定？ | 阻塞 2.2 的设计系统统一，即本轮最主要的交付物 | 高 |
| Q3 | 是否直接按移动优先重做？ | 影响组件库选择（NutUI 是移动端规范，桌面端观感一般） | 高 |
| Q4 | 目标用户浏览器版本分布？ | 决定 8.1 的风险是否可接受 | 中 |
| Q5 | 字体栈是否现在就改（2.1）？ | 唯一会立刻改变现有观感的改动，收益/成本比最高 | 中 |

**Q1 建议优先回答。** 如果是个人主体，小程序这条路的可行性需要重新评估，本文第 5 节的组件库结论和第 8 节的策略都会随之改变 —— 那种情况下 shadcn/ui + Radix 会重新成为最优选（视觉质量最高、定制性最强），因为同构约束不再成立。
