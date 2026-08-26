# 代码审查报告

## 审查范围

- 审查时间：2026-08-25
- 审查目标：`review-lens/` 全量 24 个 `.js` 与 2 个 `.css`。本报告补齐此前未覆盖的三个模块：**结构与依赖（11 条）、单元设计（7 条）、样式（8 条）**。已跳过：`manifest.json` 与图片（条款未覆盖的文件类型）、HTML（同）。单元测试已按 TD-11 从仓库移除，无需剔除。行为层见 `review-lens-behavior.md`，语句写法见 `review-lens-statements.md`，表意见 `review-lens-expression.md`。
- 审查依据：JS/TS 代码约定，本次覆盖 结构与依赖、单元设计、样式；lint 采信情况 **未接入，全部转人工核对**——仓库刻意零依赖、无 eslint/stylelint/tsc（TD-11）；判为不适用的规则：样式模块中依赖 SCSS 语法的条款（纯 CSS，无嵌套、无 `&`、无 mixin），以及「规则块顺序对齐 JSX 结构」（该条以 CSS Modules + 同目录 JSX 为前提，本项目两者都没有）

## 结论

本次三个模块**没有阻断项**。结构面是干净的：`core/` 不反向依赖 `ui`/`content`/`popup`，没有 barrel，没有 `export default`，24 个文件的 28 条相对 import 目标全部存在。

发现并已修的问题集中在两类。一是**同一份知识散在多处**：四组状态机取值（视图模式、抽屉状态、锚点侧、代码栏侧）跨文件裸用字面量，而这个项目自己早已把 `COMPARE_STATE`、`ERROR_KIND`、`MESSAGE_ACTION` 具名了——口径不一致；`side` 到改动类别的映射更是写了三遍（读哪个行号字段、只标哪类 op、加哪个 class），加第三态必漏一处。二是**多余的暴露面**：8 个导出零外部引用，它们原本是给已删除的测试用的，留着会让人以为别处依赖。样式侧则是 `z-index: 2147483000` 裸写、以及裸色值在同文件内重复（`#fff` 六处、`#b9bcf7`/`#e0e2ff` 各两处）。

**结论有可靠性折扣**：三个模块共 26 条全部人工核对，其中「import 分组排序」「块内声明按 recess-order 排列」「类名与自定义属性命名」本可由 eslint / stylelint 一次给出确定结论。recess-order 一项我没有逐块判序——人工判定声明顺序不可靠，宁可标为未覆盖也不给一个似是而非的结论。**建议先接入 lint**：扩展产物可以保持零依赖，eslint 只进 devDependencies 或借外部规范仓库的配置从外部 lint，两种做法都不会让扩展目录多出文件。

| 级别    | 数量 |
| ------- | ---- |
| 🔴 阻断 | 0    |
| 🟡 应改 | 6    |
| 🔵 优化 | 2    |

## 违规项

全部已修，状态列标注修法落点。

| 级别    | 状态 | 文件:行号 | 违反的约定 | 现状 | 建议改法 |
| ------- | ---- | --------- | ---------- | ---- | -------- |
| 🟡 应改 | 已修复 | `review-lens/ui/drawer.js`、`review-lens/core/store.js`、`review-lens/content/entry.js`、`review-lens/core/thread.js`、`review-lens/core/compare.js`、`review-lens/ui/code-pane.js` | 跨文件共享的约定收敛为具名常量，不在各处裸写字面量 | 四组状态机取值散在多文件裸用：视图模式 `"stacked"`/`"side"`（5 处）、抽屉状态 `"ready"`/`"loading"`/`"failed"`（7 处，取数方与渲染方各一个文件）、锚点侧 `"old"`/`"new"`（产出方与消费方各一个文件）、代码栏侧 `"then"`/`"now"`。而同项目已具名 `COMPARE_STATE`/`ERROR_KIND`/`MESSAGE_ACTION` | 各建具名常量：`VIEW`（drawer 内）、`DRAWER_STATUS`（drawer 导出、entry 消费）、`ANCHOR_SIDE`（thread 导出、compare 消费）、`PANE_SIDE`（code-pane 导出、drawer 消费） |
| 🟡 应改 | 已修复 | `review-lens/ui/code-pane.js:9` | 同一个映射只写一处 | `side` 到改动类别的映射写了三遍：`CHANGE_ON = { then: "remove", now: "add" }`、`lineKey = side === "then" ? …`、`changeType: side === "then" ? "removed" : "added"`。三处用了两套词形（`remove`/`removed`），加第三态必漏一处 | 并成一张 `SIDE` 表，每侧一行给出 `lineKey` / `opType` / `className` |
| 🟡 应改 | 已修复 | `review-lens/ui/drawer.js`、`review-lens/core/thread.js`、`review-lens/core/attachment.js`、`review-lens/content/entry.js` | 只在本文件用的符号不 export——多余的暴露面会让人以为别处依赖它，重构时不敢动 | 8 个导出零外部引用：`HOST_TAG`、`MIN_WIDTH`、`MAX_WIDTH`、`PER_PAGE`、`resolveAttachment`、`ENTRY_CLASS`、`DISCUSSION_SELECTOR`、`attachEntries`。它们原本供已删除的测试使用 | 去掉 `export`，保留为模块内声明 |
| 🟡 应改 | 已修复 | `review-lens/background.js:25` 对 `review-lens/core/messages.js:2` | 同一批成员的重复列举保持同序 | 消息处理表的键序与协议声明序不一致：协议是 `… writeSettings registerOrigin unregisterOrigin openSettings pageActive`，处理表是 `… writeSettings openSettings pageActive registerOrigin unregisterOrigin`。顺序不一致时读者无法靠位置对照，只能逐个搜 | 处理表按协议声明序重排 |
| 🟡 应改 | 已修复 | `review-lens/ui/drawer.js:1`、`review-lens/popup/popup.js:1`、`review-lens/content/entry.js:1` | import 按来源分组、组内按字母升序 | 三个文件的 parent 组不是字母序：drawer 是 identifier→attachment→compare→related；popup 是 messages→export；entry 是 gitlab→page→compare→messages→thread | 组内按路径字母升序重排，parent 组与 sibling 组之间留空行 |
| 🟡 应改 | 已修复 | `review-lens/ui/drawer.css:27` | z-index 收口到变量，不在规则里裸写数值 | `z-index: 2147483000` 裸写。这个值本身是正当的（注入宿主页的浮层要盖住 GitLab 的一切），但裸写让读者无从判断它是不是随手敲的 | 抽成 `--layer-top` 并注释说明取 int32 上限附近的理由 |
| 🔵 优化 | 已修复 | `review-lens/ui/drawer.css`、`review-lens/popup/popup.css` | 设计值收敛为变量，同一色值不在多处重复 | 同文件内重复的裸色值：drawer 里 `#fff` 六处、`#b9bcf7` 两处、`#e0e2ff` 两处、`#2f3a52` 与 `#8a93a8` 各两处；popup 里 `#fff` 五处。另有 `#ffffff` 与 `#fff` 两种写法混用 | 背景白走已有的 `--card`；新增 `--chip-line`/`--chip-bg`（标识符 chip 的描边与底色）与 `--on-mark`（主色实底之上的前景色，与 `--card` 同值但语义不同）；`--head-fg` 改为引用 `--ink` |
| 🔵 优化 | 已修复 | `review-lens/core/store.js:16` | 需要同步的同一份值只声明一处 | 默认视图 `"stacked"` 在存储层与 UI 层各一份（与已修的默认宽度 820 同一模式） | 存储层用 `null` 表示「用户没切过」，默认视图由抽屉定义 |

## 逐条核对后无违规

列明以免读者误以为漏审：

**结构与依赖** — 单一来源（本次范围内未再发现重复；此前五组已在 todo 清单第 11 条修完）、依赖方向单向（`core/` 无对 `ui`/`content`/`popup` 的引用）、跨模块只依赖公开契约（无深入他人内部文件的路径）、导入路径形式（无构建工具与路径别名，按未配置档判定，相对路径正确）、不设 barrel（无 `index.js` 转发层）、导出形式固定（无 `export default`）、领域分组收敛（`core`/`ui`/`content`/`popup` 四个域无同前缀平铺文件）、强耦合概念同文件闭环（判别态与其消费者同文件）、常量按辐射范围就近声明（本次收口后各常量都在其唯一或首个消费者所在文件）。

**单元设计** — 一个单元只做一件事、同一函数内抽象层级一致（`drawer.js` 虽长，但每个 `renderXxx` 只负责自己那块 DOM，主 `render` 只做编排）、重复逻辑抽取（`flashLine` 已在 todo 清单第 11 条抽出）、声明贴着第一个消费者、无内聚关系时按形态兜底、同一批成员同序（本次修掉消息表那一处后无其余）。

**样式** — 类名与自定义属性命名（类名全 kebab、自定义属性全 kebab）、嵌套层级（纯 CSS 无嵌套，不适用）、纯交互反馈用伪类（无 `data-hovered`/`isHovered` 这类为样式而造的状态，全走 `:hover`/`:focus`）、关键字大小写（无大写关键字，字体族名与自定义属性未被误判）。

## 本次未覆盖

**块内声明按 recess-order 排列（🔵）** — 未逐块判序。这条靠 `stylelint-config-recess-order` 给确定结论，人工按记忆判定 `position`/`display`/`box`/`text` 等十余组的先后不可靠，宁可标为未覆盖。接入 stylelint 后一次 `--fix` 即可，不必人工。

## 既有债务

无。本次范围是指定目录、全部代码都是审查对象。

## 未能确认的项

无。本次三个模块的条款都靠读结构与静态扫描判定，不依赖运行时上下文。
