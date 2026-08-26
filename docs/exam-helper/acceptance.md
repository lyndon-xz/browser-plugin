# 验收计划

> 交付形态 Web/前端（Chrome 扩展）→ 验收方式为真实浏览器加载扩展 + 操作，留证为截图。
> 本文档随模块累积；M1 首次创建，后续模块（M2/M3）追加用例与结果。

## 1. 验收策略

- **验收视角**：在真实 Chrome 中加载已解压扩展（`--extension`），以用户真实操作（选中文字、取消选区、快捷键）验证 requirement.md §4 的每条验收标准。
- **通过标准**：所有用例通过 + 留证存档到 `evidence/`。
- **失败处理**：失败项回到 §6 编码修复后重新验收。

---

## 2. 验收用例（M1）

> 编号引用 requirement.md §4，这里补充“怎么验”。

| 编号 | 所属模块 | 前置条件 | 操作步骤 | 期望结果 | 留证点 |
| ---- | -------- | -------- | -------- | -------- | ------ |
| V-1 | M1 | 扩展已加载，启用状态（默认） | 1. 打开含题库题目的页面 2. 选中某题题干文字 3. 松开鼠标 4. 再取消选区 | 选区下方浮现气泡，显示答案徽章+题型+解析+来源；取消选区后气泡消失 | 命中气泡截图 / 取消后 host display=none |
| V-2 | M1 | 同上 | 选中题干的一部分（截断）或含多余空格/全角标点的变体 | 仍能匹配到对应题目并显示正确答案 | 截断选中命中截图 |
| V-3 | M1 | 同上 | 选中题目触发气泡后，审查气泡 DOM | 气泡挂在带 shadow-root 的 host 上，样式在 shadow 内、不污染宿主页 | shadowRoot 内容 / host 结构 |
| V-4 | M1 | 同上 | 按 Alt+Q 切换启用/禁用；禁用后再选中题目；再按 Alt+Q 恢复 | 禁用后选中不弹气泡；恢复后重新可弹 | 启用/禁用行为 |

---

## 3. 验收环境

| 项 | 内容 |
| --- | --- |
| 交付形态 | Web/前端 — Chrome MV3 扩展 |
| 启动/调用 | `agent-browser --extension <workspace>/exam-helper open --headed <url>` |
| 测试命令 | `cd exam-helper && npx vitest --run` |
| 验收工具 | agent-browser（真实 Chrome via CDP） + 手动确认 |
| 访问入口 | 任意含题库题目文本的网页（M1 验收用本地 fixture http 页） |
| 前置数据 | 种子题库 `data/questions.js`（4 题，含 single/multi） |

---

## 4. 留证命名规范

```
evidence/screenshots/M<N>-V<M>-<description>.png
```

---

## 5. 验收结果（M1）

| 编号 | 所属模块 | 状态 | 留证 | 备注 |
| ---- | -------- | ---- | ---- | ---- |
| V-1 | M1 | ✅ 通过 | `evidence/screenshots/M1-V1-hit-bubble.png` | 真实 Chrome 加载扩展，选中 q1 题干 → 气泡浮现「B C D / 多选 / 解析 / 📚 题库命中」，位置在选区下方带三角箭头；取消选区后 host `display=none`；无关文本（q3）不弹气泡 |
| V-2 | M1 | ✅ 通过 | 见 V-1 截图流程 | 截断选中 q2 题干前 14 字「KV结构的集合，在处理nul」→ 命中 id=2 显示「A / 单选」；单测 matcher.test.js 另覆盖乱序/多余空格/全角标点/无关文本共 11 例 |
| V-3 | M1 | ✅ 通过 | 见 V-1 截图 | 气泡挂在 `[data-exam-helper=bubble]` 的 open shadow-root 内，样式 `<style>` 注入 shadow 内、`document.head` 无气泡样式；`pointer-events:none` |
| V-4 | M1 | ⚠️ 机制通过，快捷键待手动确认 | — | 启用状态存储 setEnabled/getEnabled 单测通过（storage.test.js 7 例）；content 的 toggle→hide、background 的 commands→翻转→通知 已实现并语法校验。**实测发现 CDP 合成按键无法触发 Chrome 的 chrome.commands（全局快捷键），故 Alt+Q 的真实按键需在交互式 Chrome 手动确认**（建议：加载扩展后在页面按 Alt+Q，观察工具栏图标 active/inactive 切换及选中不再弹气泡） |

> 说明：V-1/V-2/V-3 已在真实浏览器端到端验收通过并留证；V-4 因 CDP 环境无法派发扩展全局快捷键，仅机制层验收，物理按键留待用户手动确认（skill §11 验收环境限制）。
>
> 注：本文件为项目恢复后按会话记录重建；M1 的截图留证 `evidence/screenshots/M1-V1-hit-bubble.png` 在恢复时已随工作区丢失，将在下次浏览器验收时重新生成。

---

## 6. 变更记录

| 版本 | 日期 | 变更内容 | 影响范围 |
| ---- | ---- | -------- | -------- |
| v1 | 2026-07-22 20:58 | 初始版本：M1 验收用例与结果（V-1~V-4） | M1 |
