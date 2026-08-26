# 技术架构

## 1. 技术选型

> 交付形态为 Web/前端 — Chrome Extension (Manifest V3)，纯前端（content script + service worker + popup），无自建后端。下表已按此形态裁剪。

| 层             | 技术 | 选择理由 |
| -------------- | ---- | -------- |
| 运行平台       | Chrome 88+，Manifest V3 | 需求 §6 兼容性要求；MV3 是当前 Chrome 扩展标准，与参考项目 `search-sort/` 一致 |
| 开发语言       | 原生 JavaScript（ES2020），零构建 | 与参考项目 `search-sort/` 完全一致；扩展逻辑简单，无需 TS/打包，直接加载已解压扩展即可调试 |
| UI 框架        | 无（原生 DOM + Shadow DOM） | 唯一 UI 是答案气泡，用 Shadow DOM 隔离渲染（design.md §7 约束），引入框架反而增重 |
| 状态管理       | `chrome.storage.local` | 仅需持久化“启用/禁用”一个布尔状态，跨 content/background 共享 |
| 路由           | 无 | 单一注入式 overlay，无页面导航（design.md §3） |
| 样式/UI 组件库 | Shadow DOM 内联 CSS | 样式随气泡组件内联注入 shadow-root，与宿主页 CSS 完全隔离（V-3） |
| 后端/服务      | 无自建后端；外部依赖 DeepSeek Chat API | 题库未命中时的兜底推理（US-4），直接从 content/background 发起 HTTPS 请求 |
| 数据存储       | 静态题库 JS 文件（打包进扩展）+ `chrome.storage.local`（开关状态） | 题库预置随扩展分发（US-3、5.2 不做在线更新）；开关状态本地持久化 |
| 构建/打包/分发 | 无构建步骤；`chrome://extensions` 加载已解压扩展 | 零构建心智，与参考项目一致；分发即打包目录 |
| 测试框架       | Vitest（Node 环境，仅开发依赖） | 对纯逻辑模块（匹配引擎、DeepSeek 请求构造/响应解析）做 TDD 单测；不随扩展分发 |
| 部署方式       | 手动加载已解压扩展（开发）/ 打包 zip（分发） | 无需 CI/CD，个人使用 |

> 编号规则：TD = Tech Decision（技术决策）

| ID   | 决策 | 备选方案 | 理由 |
| ---- | ---- | -------- | ---- |
| TD-1 | 原生 JS + 零构建 | TypeScript + Vite/webpack 打包 | 扩展逻辑体量小、参考项目已验证零构建模式；引入构建链增加维护成本，收益低 |
| TD-2 | 逻辑模块用 UMD 式包装（同时兼容浏览器全局与 Node require） | 纯全局脚本（不可 Node 测试）/ 全量 ESM（content script 加载受限） | 让匹配引擎、DeepSeek 客户端等纯逻辑既能被 manifest 以普通脚本加载暴露全局，又能被 Vitest 在 Node 下 require，满足 TDD 红绿循环 |
| TD-3 | 快捷键走 MV3 `commands` API（后台 `chrome.commands.onCommand`） | content script 内监听 `keydown` | commands API 是 MV3 全局快捷键标准，不受页面焦点/输入框吞事件影响，更可靠（V-4） |
| TD-4 | DeepSeek 请求在 background service worker 发起 | 在 content script 直接 fetch | 规避宿主页 CSP 对跨域请求的限制，也让 API key 不出现在页面上下文，降低泄露面 |
| TD-5 | 题库以 JS 数组常量打包（`data/questions.js`） | JSON 文件 + fetch(chrome.runtime.getURL) | 常量随脚本同步加载、无异步时序问题，匹配引擎可直接引用；题库稳定无需运行时拉取 |

---

## 2. 架构总览

扩展由三个运行上下文构成，通过 `chrome.runtime` 消息通道协作：

- **Content Script（注入宿主页）**：监听文本选区，编排“匹配题库 → 命中显示 / 未命中请求 AI”的流程，并在 Shadow DOM 中渲染答案气泡。
- **Service Worker（后台）**：接收 `Alt+Q` 全局快捷键切换启用状态、维护扩展图标、代理 DeepSeek API 请求（规避宿主页 CSP、隔离 API key）。
- **Popup（可选轻量）**：显示当前启用状态与用法提示（沿用参考项目结构，非核心路径）。

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
- 鉴权：`Authorization: Bearer <API_KEY>`（key 写死在 `background.js`，见 §8）
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
| 存储封装 | 读写启用状态 | `utils/storage.js` | `getEnabled()`、`setEnabled(bool)`；被 content/background/popup 共用 |

---

## 4. 数据模型

### 4.1 实体关系

单实体，无关系：**题目（Question）** 常量数组，匹配引擎按题干做模糊匹配后返回单个命中项。启用状态为独立的布尔标志存于 `chrome.storage.local`。

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

#### 启用状态（`chrome.storage.local`）

| 字段 | 类型 | 说明 | 约束 |
| ---- | ---- | ---- | ---- |
| enabled | boolean | 自动匹配功能是否启用 | 默认 `true`；Alt+Q 翻转 |

---

## 5. 对外接触面契约

> 本产品为纯前端 Chrome 扩展，对外接触面（答案气泡的外观与交互）已在 `design.md` 定义；DeepSeek 为消费的第三方 API（其调用形态记于 §2 数据流），非本项目设计并对外发布的契约。故本章按模板说明删除，无自建对外契约。

---

## 6. 目录结构

> **约束：本项目所有产物（扩展代码 + 开发期测试工具链）全部收敛在 `exam-helper/` 目录内，不向工作区根目录扩散。** `package.json`、`vitest.config.js`、`__tests__/`、`node_modules/` 均位于 `exam-helper/` 内。

```
exam-helper/                      # 扩展根目录（新建，与 search-sort/ 平级）；所有产物都在此目录内
├── manifest.json                 # MV3 清单：content_scripts / background / commands(Alt+Q) / action
├── background.js                 # 后台：快捷键切换、图标、代理 DeepSeek 请求
├── content.js                    # 选区编排入口（manifest 注入）
├── data/
│   └── questions.js              # 静态题库常量 EXAM_QUESTIONS（M2 抓取 CSDN 后填充）
├── content/
│   └── bubble.js                 # Shadow DOM 气泡渲染（命中/loading/错误三态）
├── utils/
│   ├── matcher.js                # 归一化 + 模糊匹配（纯逻辑，UMD 包装可测）
│   ├── deepseek.js               # 请求构造 + 响应解析（纯逻辑，UMD 包装可测）
│   └── storage.js                # chrome.storage.local 启用状态封装
├── popup/
│   ├── popup.html                # 状态与用法提示（沿用参考项目结构）
│   ├── popup.css
│   └── popup.js
├── icons/                        # 复用/仿照 search-sort 的 active/inactive 图标集
│
│   # ↓ 开发期测试（仅本地，不随扩展分发；打包 zip 时排除）
├── package.json                  # vitest 开发依赖 + test 脚本
├── vitest.config.js              # 测试配置（node 默认，jsdom 按需）
├── .gitignore                    # 忽略 node_modules / package-lock
└── __tests__/                    # 就近共置的单测（matcher / deepseek / bubble 等）
```

> `manifest.json` 的 `content_scripts.js` 按依赖顺序加载：`data/questions.js` → `utils/matcher.js` → `utils/storage.js` → `content/bubble.js` → `content.js`（storage 供 content 读启用状态）；`background.js` 通过 `importScripts` 引入 `utils/storage.js`（M3 再引入 `utils/deepseek.js`）。

---

## 7. 环境与部署

### 7.1 开发环境

- 依赖安装：在 `exam-helper/` 目录下 `npm install`（仅安装 Vitest 等开发依赖，用于单测）
- 运行单测：`cd exam-helper && npx vitest --run`
- 加载扩展：Chrome → `chrome://extensions` → 开启开发者模式 → “加载已解压的扩展” → 选择 `exam-helper/` 目录
- 环境变量：无（DeepSeek API key 写死在 `background.js`，见 §8）

### 7.2 部署方案

个人使用，无 CI/CD。分发时将 `exam-helper/` 目录打包为 zip 即可（打包时排除 `node_modules/`、`__tests__/`、`package.json`、`vitest.config.js`、`.gitignore` 等开发期文件）。

---

## 8. 安全考虑

| 风险 | 处置 |
| ---- | ---- |
| API key 明文写死在代码中，随扩展分发可被提取 | 需求 §5.1 已明确接受（Q-6：直接写死）；仅限个人使用不公开分发；key 置于 background service worker 上下文，不注入宿主页面，降低页面侧泄露面（TD-4） |
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
