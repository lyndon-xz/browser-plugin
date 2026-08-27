# 技术架构

## 1. 技术选型

**测试策略**：无单测 — 个人使用的注入式扩展，验收靠真实 Chrome 加载 + 操作留证；单测工具链曾拦截仓库推送无关、且密钥改为本机配置后关键路径在 popup/storage，不值得再维护 Vitest（TD-6）。后续编码走「实现 → 按 V-x 真实使用验证」。

> 交付形态为 Web/前端 — Chrome Extension (Manifest V3)，纯前端（content script + service worker + popup），无自建后端。下表已按此形态裁剪。

| 层             | 技术 | 选择理由 |
| -------------- | ---- | -------- |
| 运行平台       | Chrome 88+，Manifest V3 | 需求 §6 兼容性要求；MV3 是当前 Chrome 扩展标准，与参考项目 `search-sort/` 一致 |
| 开发语言       | 原生 JavaScript（ES2020），零构建 | 与参考项目 `search-sort/` 完全一致；扩展逻辑简单，无需 TS/打包，直接加载已解压扩展即可调试 |
| UI 框架        | 无（原生 DOM + Shadow DOM） | 答案气泡用 Shadow DOM 隔离（design.md §7）；popup 用原生 HTML/CSS |
| 状态管理       | `chrome.storage.local` | 持久化启用开关 + DeepSeek API key（V-4、V-8），跨 popup/background/content |
| 路由           | 无 | 注入式 overlay + 工具栏 popup，无页面导航 |
| 样式/UI 组件库 | Shadow DOM 内联 CSS + popup.css | 气泡样式注入 shadow-root（V-3）；popup 独立样式表，色板与气泡对齐 |
| 后端/服务      | 无自建后端；外部依赖 DeepSeek Chat API | 题库未命中时的兜底推理（US-4），由 background 发起 HTTPS 请求 |
| 数据存储       | 静态题库 JS 文件（打包进扩展）+ `chrome.storage.local`（开关 + key） | 题库预置随扩展分发；密钥只存本机，不进源码（Q-6） |
| 构建/打包/分发 | 无构建步骤；`chrome://extensions` 加载已解压扩展 | 零构建心智，与参考项目一致；分发即打包目录 |
| 测试框架       | — | 无单测（TD-6）；不安装 Vitest/jsdom，不保留 `__tests__/` |
| 部署方式       | 手动加载已解压扩展（开发）/ 打包 zip（分发） | 无需 CI/CD，个人使用 |

> 编号规则：TD = Tech Decision（技术决策）

| ID   | 决策 | 备选方案 | 理由 |
| ---- | ---- | -------- | ---- |
| TD-1 | 原生 JS + 零构建 | TypeScript + Vite/webpack 打包 | 扩展逻辑体量小、参考项目已验证零构建模式；引入构建链增加维护成本，收益低 |
| TD-2 | 逻辑模块用 UMD 式包装（浏览器全局 + service worker `importScripts`） | 纯全局脚本 / 全量 ESM | content script 按顺序加载全局；background 用 importScripts；不再为 Node 单测服务 |
| TD-3 | 快捷键走 MV3 `commands` API（后台 `chrome.commands.onCommand`） | content script 内监听 `keydown` | commands API 是 MV3 全局快捷键标准，不受页面焦点/输入框吞事件影响，更可靠（V-4） |
| TD-4 | DeepSeek 请求在 background service worker 发起 | 在 content script 直接 fetch | 规避宿主页 CSP；API key 只在 worker 与 storage 中出现，不进页面上下文 |
| TD-5 | 题库以 JS 数组常量打包（`data/questions.js`） | JSON 文件 + fetch(chrome.runtime.getURL) | 常量随脚本同步加载、无异步时序问题，匹配引擎可直接引用；题库稳定无需运行时拉取 |
| TD-6 | 无单测，拆除 Vitest/jsdom/`__tests__/`/`package.json` | 继续测试驱动 | 验收靠真实 Chrome 操作留证；用户明确要求切无单测（Q-7）；密钥路径在 popup/storage，单测覆盖不到 |
| TD-7 | API key 存 `chrome.storage.local.deepseekApiKey`，popup 读写，background 读取 | 写死在 `background.js` / `chrome.storage.sync` | 写死会被 GitHub push protection 拦截且进仓库历史；sync 会把密钥同步到 Google 账号，超出「本机」范围 |

---

## 2. 架构总览

扩展由三个运行上下文构成，通过 `chrome.runtime` 消息通道协作：

- **Content Script（注入宿主页）**：监听文本选区，编排“匹配题库 → 命中显示 / 未命中请求 AI”的流程，并在 Shadow DOM 中渲染答案气泡。
- **Popup**：显示启用状态；本机填写/更新 DeepSeek API key（V-8，核心路径）。
- **Service Worker（后台）**：接收 `Alt+Q` 全局快捷键切换启用状态、维护扩展图标、从 storage 读取 key 并代理 DeepSeek API 请求（规避宿主页 CSP）。空 key 不发请求，返回引导配置的错误。

核心数据流（选中即出答案）：

```
用户在宿主页选中题目文字
        │  selectionchange / mouseup
        ▼
  content.js（编排）
        │  debounce 300ms，取选区文本
        ▼
  utils/matcher.js  ── 归一化 + 模糊匹配 ──▶ data/questions.js（静态题库）
        │
        ├── 命中 ─────────────▶ content/bubble.js 渲染【题库命中态】(V-1,V-2)
        │
        └── 未命中
              │ bubble 渲染【AI 推理中…】
              │ chrome.runtime.sendMessage({action:"askAI", text})
              ▼
        background.js ── fetch DeepSeek Chat API ──▶ 返回答案 / 错误
              │
              ▼
        content/bubble.js 渲染【AI 答案态】(V-6) / 【错误态】(V-7)

取消选区 → content.js 监听 → bubble.hide()（立即消失）

Alt+Q → background commands.onCommand → 翻转 storage.enabled
      → 更新图标 + 通知当前标签 content.js → 更新启用标志（禁用则隐藏气泡）(V-4)
```

**外部依赖 — DeepSeek Chat API**（非本项目自建契约，为消费的第三方接口）：

- 端点：`POST https://api.deepseek.com/chat/completions`
- 鉴权：`Authorization: Bearer <API_KEY>`（key 从 `chrome.storage.local` 读取，见 TD-7）
- 请求：`{ model: "deepseek-chat", messages: [{role:"system", ...规范答题提示}, {role:"user", content: 选区文本}], temperature: 0 }`
- 响应：`choices[0].message.content` 为模型返回文本，由 `utils/deepseek.js` 解析为 `{answer, explain}` 结构后渲染

---

## 3. 模块划分

> 此处为模块间内部接口/依赖。本产品为纯前端扩展，无自建对外接触面契约（见 §5 说明）。

| 模块 | 职责 | 关键文件 | 模块间接口/依赖 |
| ---- | ---- | -------- | --------------- |
| 题库数据 | 预置全量真题常量（题干/类型/答案/解析） | `data/questions.js` | 暴露 `EXAM_QUESTIONS` 数组，被匹配引擎读取 |
| 匹配引擎 | 文本归一化 + 模糊匹配题库，纯函数 | `utils/matcher.js` | `Matcher.match(questions, text) → 命中项 \| null`；被 content.js 调用 |
| DeepSeek 客户端 | 构造请求体、解析响应文本为结构化答案，纯逻辑（fetch 注入） | `utils/deepseek.js` | `buildRequest(text)`、`parseResponse(json) → {answer, explain}`；被 background.js 调用 |
| 气泡渲染 | 创建 Shadow DOM host、按状态渲染、定位、隐藏 | `content/bubble.js` | `Bubble.show(state, data, rect)`、`Bubble.hide()`；被 content.js 调用 |
| 选区编排 | 监听选区变化、debounce、串联匹配/AI、响应启用开关 | `content.js` | 监听 DOM 事件 + `chrome.runtime` 消息；调用 matcher/bubble |
| 后台 | 快捷键切换、图标状态、代理 DeepSeek 请求 | `background.js` | `chrome.commands`、`chrome.runtime.onMessage`、`chrome.action` |
| 存储封装 | 读写启用状态与 API key | `utils/storage.js` | `getEnabled()` / `setEnabled(bool)` / `getApiKey()` / `setApiKey(string)`；被 content/background/popup 共用 |

---

## 4. 数据模型

### 4.1 实体关系

单实体，无关系：**题目（Question）** 常量数组，匹配引擎按题干做模糊匹配后返回单个命中项。启用状态与 API key 为独立字段，存于 `chrome.storage.local`。

### 4.2 数据表/集合设计

#### Question（`data/questions.js` 中 `EXAM_QUESTIONS` 数组元素）

| 字段 | 类型 | 说明 | 约束 |
| ---- | ---- | ---- | ---- |
| id | number | 题目序号 | 唯一，自增 |
| type | string | 题型：`"single"`（单选）/ `"multi"`（多选） | 枚举 |
| title | string | 题干原文 | 非空 |
| options | `{key,text}[]` | 选项列表（可选，用于展示上下文） | 可空；key 为 A/B/C/D… |
| answer | `string[]` | 正确选项 key 列表，如 `["B","C","D"]` | 非空数组 |
| explain | string | 简要解析 | 可空 |

> 匹配时对 `title`（及 `options` 文本）与选区文本统一做归一化（去空格、全半角、大小写、标点），支持顺序不同/多余空格/部分截断的模糊匹配（V-2）。

#### 本地状态（`chrome.storage.local`）

| 字段 | 类型 | 说明 | 约束 |
| ---- | ---- | ---- | ---- |
| enabled | boolean | 自动匹配功能是否启用 | 默认 `true`；Alt+Q 翻转 |
| deepseekApiKey | string | 用户在 popup 填写的 DeepSeek API key | 可空；空则 AI 兜底不发请求（V-8）；仅本机，不进源码 |

---

## 5. 对外接触面契约

> 本产品为纯前端 Chrome 扩展，对外接触面（答案气泡的外观与交互）已在 `design.md` 定义；DeepSeek 为消费的第三方 API（其调用形态记于 §2 数据流），非本项目设计并对外发布的契约。故本章按模板说明删除，无自建对外契约。

---

## 6. 目录结构

> **约束：本项目所有产物全部收敛在 `exam-helper/` 目录内，不向工作区根目录扩散。** 无 npm 工程、无单测目录。

```
exam-helper/                      # 扩展根目录（与 search-sort/ 平级）
├── manifest.json                 # MV3 清单：content_scripts / background / commands(Alt+Q) / action
├── background.js                 # 后台：快捷键切换、图标、读 storage key 代理 DeepSeek
├── content.js                    # 选区编排入口（manifest 注入）
├── data/
│   └── questions.js              # 静态题库常量 EXAM_QUESTIONS
├── content/
│   └── bubble.js                 # Shadow DOM 气泡渲染（命中/loading/错误三态）
├── utils/
│   ├── matcher.js                # 归一化 + 模糊匹配
│   ├── deepseek.js               # 请求构造 + 响应解析
│   └── storage.js                # chrome.storage.local：enabled + deepseekApiKey
├── popup/
│   ├── popup.html                # 状态 + 本机密钥配置（V-8）
│   ├── popup.css
│   └── popup.js
├── icons/                        # active/inactive 图标集
└── .gitignore
```

> `manifest.json` 的 `content_scripts.js` 按依赖顺序加载：`data/questions.js` → `utils/matcher.js` → `utils/storage.js` → `content/bubble.js` → `content.js`；`background.js` 通过 `importScripts` 引入 `utils/storage.js`、`utils/deepseek.js`。popup 在自身页面加载 `utils/storage.js` + `popup.js`。

---

## 7. 环境与部署

### 7.1 开发环境

- 依赖安装：无（零构建，无 npm 依赖）
- 运行单测：—（无单测）
- 加载扩展：Chrome → `chrome://extensions` → 开启开发者模式 → “加载已解压的扩展” → 选择 `exam-helper/` 目录
- 环境变量：无。DeepSeek API key 由用户在 popup 写入 `chrome.storage.local`（TD-7）

### 7.2 部署方案

个人使用，无 CI/CD。分发时将 `exam-helper/` 目录打包为 zip 即可。

---

## 8. 安全考虑

| 风险 | 处置 |
| ---- | ---- |
| API key 曾写死在源码，GitHub push protection 拦截 | 改为 popup 本机配置、存 `chrome.storage.local`（TD-7、V-8）；源码禁止出现真实 key；**已推过的历史提交仍含旧 key，需改写历史后才能推 main** |
| API key 出现在页面上下文 | key 只由 popup 写入、background 读取，不注入 content script（TD-4） |
| Shadow DOM 样式/DOM 泄露到宿主页 | 气泡全部在 shadow-root 内渲染，`pointer-events:none`，隐藏时 host 尺寸为 0，不修改宿主页现有元素（V-3、design.md §7） |
| DeepSeek 请求失败/超时导致气泡异常 | `utils/deepseek.js` 捕获异常，渲染友好错误态，不白屏不崩溃（V-7）；请求 5s 超时（需求 §6） |
| content script 因扩展重载变为孤儿，`sendMessage` 抛异常 | 沿用参考项目做法：`try/catch` + Promise `.catch` 静默降级 |
| 在第三方/内网考试页注入脚本 | `host_permissions` 按需最小化；不采集、不上传选区内容到除 DeepSeek 外的任何端点 |

---

## 9. 变更记录

| 版本 | 日期             | 变更内容 | 影响范围 |
| ---- | ---------------- | -------- | -------- |
| v1   | 2026-07-22 19:41 | 初始版本 | 全部     |
| v2   | 2026-07-22 20:58 | 明确所有产物（含测试工具链）收敛在 exam-helper/ 内不向根扩散；§6 content_scripts 加载顺序补入 utils/storage.js；§7 命令改为在 exam-helper/ 下执行 | §6 目录结构、§7 环境部署 |
| v3   | 2026-08-27 17:27 | 测试策略切无单测（TD-6），拆除 Vitest 工具链；API key 改 storage + popup（TD-7）；安全与目录结构同步 | §1、§2、§4、§6、§7、§8 |
