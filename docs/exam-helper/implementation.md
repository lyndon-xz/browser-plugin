# 实现计划

> 模块映射（requirement.md §3）：M1 = US-1+US-2（V-1~V-4）；M2 = US-3（V-5 完整题库）；M3 = US-4（V-6/V-7 DeepSeek 兜底）。
> 目录与文件命名见 architecture.md §6；纯逻辑模块（matcher/deepseek）用 UMD 包装以兼容 Vitest（TD-2）。

## M1：走通骨架（walking skeleton）

> 端到端最薄切片：**用户在宿主页选中文字 → content.js 取选区 → matcher 在种子题库上模糊匹配 → Shadow DOM 气泡显示命中答案 → 取消选区气泡消失**，并叠加 Alt+Q 全局开关。
> 这一刀贯穿注入/事件监听/匹配逻辑/Shadow DOM 渲染/后台快捷键/存储所有层，先把扩展骨架端到端跑通。题库此阶段仅用 3~5 题种子数据，全量题库留到 M2。
> 完成后：系统端到端可跑通，骨架就绪；**此模块验收通过前，M2/M3 不并行启动**。

### M1-S1: 脚手架与测试工具链

- [x] 完成

| 属性         | 内容                                                                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 功能描述     | 建立 `exam-helper/` 扩展目录骨架与 MV3 manifest、开发期 Vitest 工具链、种子题库；跑通一次空测试确认工具链就绪                                                                           |
| 涉及文件     | `exam-helper/manifest.json`、`package.json`、`vitest.config.js`、`exam-helper/data/questions.js`（种子 3~5 题）、`exam-helper/icons/`（复用/仿 search-sort）、`__tests__/smoke.test.js` |
| 对应验收标准 | —（基础设施，支撑 V-1~V-4）                                                                                                                                                             |
| 测试点       | 一个 smoke 测试断言 `EXAM_QUESTIONS` 为非空数组且每项含 `id/type/title/answer` 字段                                                                                                     |
| 前置依赖     | 无                                                                                                                                                                                      |
| 可并行       | 否（其余步骤的地基）                                                                                                                                                                    |

**实现要点**：

- `manifest.json`：MV3；`content_scripts.js` 顺序 `data/questions.js → utils/matcher.js → utils/storage.js → content/bubble.js → content.js`，`run_at: document_end`；`background.service_worker: background.js`；`commands` 定义 `toggle-enable` 建议键 `Alt+Q`；`permissions: ["storage","activeTab"]`，`host_permissions: ["<all_urls>"]`。
- `data/questions.js`：UMD 包装暴露 `EXAM_QUESTIONS`（浏览器挂全局 / Node 可 require）；种子含至少 1 单选 + 1 多选，结构按 architecture.md §4.2。
- `package.json`：仅 devDependency `vitest`；`"test": "vitest --run"`。node_modules/**tests** 不随扩展分发。

---

### M1-S2: 匹配引擎（归一化 + 模糊匹配）

- [x] 完成

| 属性         | 内容                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| 功能描述     | 实现文本归一化与题库模糊匹配纯函数，支持顺序不同、多余空格、部分截断仍能命中                                                          |
| 涉及文件     | `exam-helper/utils/matcher.js`、`__tests__/matcher.test.js`                                                                           |
| 对应验收标准 | V-2                                                                                                                                   |
| 测试点       | 归一化去空格/全半角/大小写/标点；完全一致命中；乱序词命中；多余空格命中；截断片段命中；无关文本返回 null；返回命中项含 answer/explain |
| 前置依赖     | M1-S1                                                                                                                                 |
| 可并行       | 是（与 M1-S3、M1-S4 不同文件）                                                                                                        |

**实现要点**：

- `Matcher.normalize(text)`：去所有空白、转小写、全角转半角、剔除标点。
- `Matcher.match(questions, text)`：对归一化后的选区文本与每题 `title`（+ 可选 options 文本）做包含/相似度匹配，返回最佳命中项或 `null`；性能满足 < 100ms（需求 §6）。
- UMD 包装（TD-2）。

---

### M1-S3: 气泡渲染（Shadow DOM，三态）

- [x] 完成

| 属性         | 内容                                                                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 功能描述     | 创建 Shadow DOM host，按状态渲染气泡（命中/loading/错误三态），定位到选区下方，提供 hide                                                       |
| 涉及文件     | `exam-helper/content/bubble.js`、`__tests__/bubble.test.js`（jsdom 环境）                                                                      |
| 对应验收标准 | V-3（本模块验收仅走命中态；loading/错误态供 M3 消费）                                                                                          |
| 测试点       | `show` 后存在 shadow-root 且样式在 shadow 内、不泄露到 document；命中态渲染答案徽章+解析+来源标签；`hide` 后 host 尺寸为 0；定位超出视口时上翻 |
| 前置依赖     | M1-S1                                                                                                                                          |
| 可并行       | 是（与 M1-S2、M1-S4 不同文件）                                                                                                                 |

**实现要点**：

- 样式取自 `designs/bubble-prototype.html`，内联注入 shadow-root；`pointer-events:none`；入场 fadeIn，无退场动效（design.md DD-4）。
- `Bubble.show(state, data, rect)`：`state ∈ {hit, loading, error}`；`Bubble.hide()`。三态渲染函数都实现（同一组件、成本低），M1 关键路径只用 hit 态。

---

### M1-S4: 存储封装（启用状态）

- [x] 完成

| 属性         | 内容                                                                               |
| ------------ | ---------------------------------------------------------------------------------- |
| 功能描述     | 封装 `chrome.storage.local` 的启用状态读写，默认启用                               |
| 涉及文件     | `exam-helper/utils/storage.js`、`__tests__/storage.test.js`（mock chrome.storage） |
| 对应验收标准 | —（支撑 V-4）                                                                      |
| 测试点       | `getEnabled` 未设置时返回默认 true；`setEnabled(false)` 后 `getEnabled` 返回 false |
| 前置依赖     | M1-S1                                                                              |
| 可并行       | 是（与 M1-S2、M1-S3 不同文件）                                                     |

**实现要点**：

- `getEnabled() → Promise<boolean>`、`setEnabled(bool) → Promise<void>`；UMD/全局兼容 background 的 `importScripts` 与 content 的脚本加载。

---

### M1-S5: 选区编排（content 入口）

- [x] 完成

| 属性         | 内容                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| 功能描述     | 监听选区变化，debounce 300ms 取选区文本调用 matcher，命中则显示命中气泡、取消选区则隐藏；受启用标志控制；监听后台切换消息 |
| 涉及文件     | `exam-helper/content.js`                                                                                                  |
| 对应验收标准 | V-1、V-4（禁用后不触发）                                                                                                  |
| 测试点       | 主要经浏览器手动验收（§8）；纯逻辑分支（debounce、enabled 判定）如可抽出则补单测                                          |
| 前置依赖     | M1-S2、M1-S3、M1-S4                                                                                                       |
| 可并行       | 是（与 M1-S6 不同文件，均依赖前批）                                                                                       |

**实现要点**：

- `document` 监听 `selectionchange`/`mouseup`，debounce 300ms（DD-3）；空选区 → `Bubble.hide()`。
- 命中 → `Bubble.show('hit', hit, selectionRect)`；未命中此阶段不处理（M3 接 AI）。
- 启用标志：初始读 `storage.getEnabled()`；`chrome.runtime.onMessage` 收后台 `toggle` 消息更新标志，禁用时立即 `hide` 且不再响应选区。
- 沿用参考项目的孤儿 content script 静默降级 try/catch。

---

### M1-S6: 后台快捷键与图标

- [x] 完成

| 属性         | 内容                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------- |
| 功能描述     | Alt+Q 全局切换启用状态，更新扩展图标，并通知当前标签的 content script                       |
| 涉及文件     | `exam-helper/background.js`、`manifest.json`（commands 段）                                 |
| 对应验收标准 | V-4                                                                                         |
| 测试点       | 主要经浏览器手动验收（§8）；toggle 后 storage 值翻转、图标切换、向当前 tab 发 `toggle` 消息 |
| 前置依赖     | M1-S4                                                                                       |
| 可并行       | 是（与 M1-S5 不同文件，均依赖前批）                                                         |

**实现要点**：

- `importScripts("utils/storage.js")`；`chrome.commands.onCommand` 监听 `toggle-enable` → 翻转 `storage.setEnabled` → `chrome.action.setIcon` active/inactive → `chrome.tabs.sendMessage(currentTab, {action:"toggle", enabled})`。
- 图标集复用/仿照 search-sort 的 active/inactive。

---

### M1 并行调度

| 批次    | 步骤                | 是否并行 | 备注                                                    |
| ------- | ------------------- | -------- | ------------------------------------------------------- |
| 第 1 批 | M1-S1               | 否       | 脚手架地基，先行                                        |
| 第 2 批 | M1-S2, M1-S3, M1-S4 | 是       | matcher/bubble/storage 三个独立文件                     |
| 第 3 批 | M1-S5, M1-S6        | 是       | content 依赖 S2/S3/S4；background 依赖 S4；两者不同文件 |

> M1 验收通过后做计划级自检（skill §8.4）：确认端到端链路真的贯通、architecture 选型经实跑仍成立、M2/M3 拆分未被证伪；有问题则先修计划再继续。

> **M1 验收结果**：V-1/V-2/V-3 真实浏览器端到端通过并留证（`evidence/screenshots/M1-V1-hit-bubble.png`）；V-4 机制通过（storage 单测 + 代码路径），物理 Alt+Q 快捷键因 CDP 无法派发 chrome.commands 需手动确认。全套单测 31 通过。详见 acceptance.md。

---

## M2：完整题库

> 完成后用户可以：大部分真题选中即秒出答案（V-5），题库覆盖 CSDN + 阿里云课程全量题目。

### M2-S1: 抓取并结构化全量题库

- [x] 完成

| 属性         | 内容                                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| 功能描述     | 用 agent-browser 抓取 CSDN 博文与阿里云课程题目，整理为结构化数据，替换/扩充 `data/questions.js` 为全量题库 |
| 涉及文件     | `exam-helper/data/questions.js`                                                                             |
| 对应验收标准 | V-5                                                                                                         |
| 测试点       | 见 M2-S2（数据完整性单测）                                                                                  |
| 前置依赖     | M1 完成；题库来源可访问（agent-browser 真实浏览器；CSDN/阿里云 403 需真实浏览器渲染，必要时用户提供全文）   |
| 可并行       | 否                                                                                                          |

**实现要点**：

- 来源：requirement.md §8（CSDN 主、阿里云补充）；两源交叉校对答案。
- 每题结构按 architecture.md §4.2：`{id,type,title,options,answer[],explain}`；单选/多选据原文标注 type。
- 抓取受阻（登录/反爬无法绕过）→ 停下请用户提供已抓取全文，不编造题目（红线 §1.2.3）。
- 已验证：agent-browser 真实浏览器可读取 CSDN 博文（web_fetch 的 403 系工具层限制，真实 Chrome 正常渲染）。

---

### M2-S2: 题库完整性校验与全量匹配抽样

- [x] 完成

| 属性         | 内容                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------- |
| 功能描述     | 对全量题库做结构完整性单测，并在全量题库上抽样验证匹配引擎命中正确                                |
| 涉及文件     | `__tests__/questions.test.js`、`__tests__/matcher.fulldb.test.js`                                 |
| 对应验收标准 | V-5                                                                                               |
| 测试点       | 每题 answer 非空、type 合法、id 唯一、无重复题干；抽取若干真题片段经 matcher 命中且答案与原文一致 |
| 前置依赖     | M2-S1                                                                                             |
| 可并行       | 否                                                                                                |

**实现要点**：

- 完整性断言防止抓取遗漏/错格；抽样匹配用例覆盖乱序/截断（复用 M1-S2 匹配能力，在真实数据上回归）。

> **M2 验收结果**：agent-browser 抓取 CSDN 全量真题（三部分共 130 条），按归一化题干去重得 **77 题**（单选 10 / 多选 67），答案按原文取值（含 `BD ====> ABD` 类订正）。completeness 单测（questions.test.js 6 例）+ 全量匹配抽样（matcher.fulldb.test.js 15 例）全绿，全套 **52 单测通过**；真实浏览器验收 V-5 通过并留证 `evidence/screenshots/M2-V5-fulldb-hit.png`。matcher 单测改用本地 fixture，与题库编号解耦。

---

## M3：DeepSeek API 兜底

> 完成后用户可以：题库未命中时气泡先显示“AI 推理中…”，随后展示 DeepSeek 答案（V-6）；调用失败时显示友好错误态（V-7）。

### M3-S1: DeepSeek 客户端（请求构造 + 响应解析）

- [ ] 完成

| 属性         | 内容                                                                                                                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 功能描述     | 实现 DeepSeek 请求体构造与响应文本解析为结构化答案的纯逻辑（fetch 注入，便于测试）                                                                                                                               |
| 涉及文件     | `exam-helper/utils/deepseek.js`、`__tests__/deepseek.test.js`                                                                                                                                                    |
| 对应验收标准 | V-6、V-7                                                                                                                                                                                                         |
| 测试点       | `buildRequest(text)` 生成含 system 提示 + user 文本、model=deepseek-chat、temperature=0 的请求体；`parseResponse(json)` 从 `choices[0].message.content` 解析出 `{answer,explain}`；响应结构异常/空时抛可捕获错误 |
| 前置依赖     | M1 完成                                                                                                                                                                                                          |
| 可并行       | 是（纯逻辑独立文件，可与 M2 并行）                                                                                                                                                                               |

**实现要点**：

- system 提示约束模型只答阿里 Java 规范单选/多选并给出选项字母 + 简短解析；UMD 包装（TD-2）；`buildRequest` 不含真实 fetch，网络在 background 执行。

---

### M3-S2: 后台 DeepSeek 代理

- [ ] 完成

| 属性         | 内容                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------- |
| 功能描述     | background 接收 content 的 askAI 消息，调用 DeepSeek API（含超时/错误处理），返回结构化答案或错误  |
| 涉及文件     | `exam-helper/background.js`                                                                        |
| 对应验收标准 | V-6、V-7                                                                                           |
| 测试点       | 经浏览器/集成验收；成功返回 `{answer,explain}`；网络异常/超时/key 无效返回 `{error}`（不抛未捕获） |
| 前置依赖     | M3-S1                                                                                              |
| 可并行       | 否                                                                                                 |

**实现要点**：

- `importScripts("utils/deepseek.js")`；`onMessage {action:"askAI", text}` → `fetch` DeepSeek（key 写死，TD-4）→ 5s 超时（AbortController，需求 §6）→ `parseResponse` → `sendResponse`；全程 try/catch 转错误对象。

---

### M3-S3: content 未命中分支编排

- [ ] 完成

| 属性         | 内容                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------- |
| 功能描述     | matcher 未命中时，气泡先渲染 loading，向 background 请求 AI，返回后渲染 AI 答案态或错误态 |
| 涉及文件     | `exam-helper/content.js`                                                                  |
| 对应验收标准 | V-6、V-7                                                                                  |
| 测试点       | 经浏览器手动验收：未命中显示“AI 推理中…”→ 显示答案；模拟失败显示错误提示不白屏            |
| 前置依赖     | M3-S2（bubble 三态已在 M1-S3 就绪）                                                       |
| 可并行       | 否                                                                                        |

**实现要点**：

- 未命中 → `Bubble.show('loading')` → `chrome.runtime.sendMessage({action:"askAI", text})` → 有 `answer` 渲染 `Bubble.show('hit', {..., source:'ai'})`（来源标签显示 🤖 AI 推理）/ 有 `error` 渲染 `Bubble.show('error', ...)`；期间取消选区仍立即 hide。

---

### M3 并行调度

| 批次    | 步骤  | 是否并行 | 备注                     |
| ------- | ----- | -------- | ------------------------ |
| 第 1 批 | M3-S1 | 是       | 纯逻辑，可与 M2 并行推进 |
| 第 2 批 | M3-S2 | 否       | 依赖 M3-S1               |
| 第 3 批 | M3-S3 | 否       | 依赖 M3-S2               |

---

## 变更记录

| 版本 | 日期             | 变更内容                                                                                 | 影响范围 |
| ---- | ---------------- | ---------------------------------------------------------------------------------------- | -------- |
| v1   | 2026-07-22 20:03 | 初始版本                                                                                 | 全部     |
| v2   | 2026-07-22 20:58 | M1 全部步骤完成并标记；补 M1 验收结果与计划级自检结论；content_scripts 顺序补 storage.js | M1       |
