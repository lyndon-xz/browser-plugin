# 验收计划

> 交付形态是 Web/前端（Chrome MV3 扩展），所以验收方式是浏览器操作、留证形态是截图。
> 由于宿主页是需要 CAS 登录态的内网 GitLab，真机验收由使用者在自己的 Chrome 里执行，Agent 侧以单元/集成测试与 API 实测作为补充证据。

## 1. 验收策略

- **验收视角**：装上扩展、打开真实 MR 讨论页，按使用者的实际动作走一遍
- **通过标准**：用例通过 + 留证存档；无法在 Agent 侧执行的用例注明由谁验过
- **失败处理**：失败项回到编码阶段修复后重新验收（本轮已发生 4 次，见 §5 备注）

---

## 2. 验收用例

| 编号 | 所属模块 | 前置条件 | 操作步骤 | 期望结果 | 留证点 |
| ---- | -------- | -------- | -------- | -------- | ------ |
| V-1  | M1 | 已装扩展、已登录 GitLab | 打开 `buyoutservice!27` 讨论页 | 每条代码评审主题的操作栏出现「解读」；GitLab AI 那类整体评论没有 | 讨论列表截图 |
| V-2  | M1 | 同上 | 点任一「解读」 | 右侧抽屉打开，顶栏文件名、评论作者与正文与页面一致 | 抽屉截图 |
| V-3  | M1 | 同上 | 看抽屉代码区 | 显示评论当时版本的片段，锚点行有 indigo 竖脊与变色行号 | 抽屉截图 |
| V-4  | M1 | 退出登录或断网 | 点「解读」 | 出现可区分的失败原因与重试；不白屏 | 失败态截图 |
| V-5  | M2 | 打开一条已被后续 commit 改过的评论 | 看抽屉下半 | 两个版本都在，默认上下堆叠，可切并排 | 对比截图 |
| V-6  | M2 | 同 V-5 | 看差异标记 | 旧侧琥珀底标删除、新侧青瓷底标新增 | 对比截图 |
| V-7  | M2 | 打开一条至今未改动的评论 | 看抽屉下半 | 显示「这处至今未改动」+ commit 计数依据，不伪造 diff | 未改动态截图 |
| V-8  | M3 | 打开正文提到类名/方法名的评论 | 看评论正文与代码 | 标识符成为可点 chip，代码中对应片段有底色；点 chip 滚到该行并闪一下 | 截图 |
| V-9  | M3 | 同上 | 点底栏「相关行 N」 | 列出候选行与命中依据；锚点行也在列表里并标明 | 浮层截图 |
| V-10 | M3 | 同上 | 点「展开完整方法体」 | 展示锚点所在完整方法，可折叠回片段 | 截图 |
| V-11 | M4 | 抽屉已打开 | 填笔记 → 点「存为学习卡片」 | 按钮转「已存」；重开浏览器后卡片仍在 | 弹窗截图 |
| V-12 | M4 | 已存若干卡片 | 打开扩展弹窗 → 按仓库筛选 → 删除一张 | 列表与计数正确，删除后同步移除 | 弹窗截图 |
| V-13 | M4 | 同上 | 点「导出 Markdown」 | 下载 .md，代码为 java 围栏块、含来源 MR 链接 | 导出文件 |
| V-14 | M5 | 全新安装、未配置 | 在已登录 GitLab 上使用；再模拟鉴权不可用 | 开箱可用；不可用时引导配令牌，配好恢复 | 截图 |
| V-15 | M5 | — | 在 GitLab 页与非 GitLab 页检查注入与全局状态 | 仅 GitLab 页注入；history API 仍是原生；window 无新增属性 | 测试输出 |
| V-16 | M5 | 切换 GitLab 界面语言 | 中英文各打开一次 | 两种语言下挂载一致 | 测试输出 |
| V-17 | M1 | 打开一条有回复的主题 | 看评论卡下方 | 按时间列出全部回复，带作者与日期；无回复时不留空块 | 抽屉截图 |

---

## 3. 验收环境

| 项        | 内容 |
| --------- | ---- |
| 交付形态  | Web/前端（Chrome MV3 扩展） |
| 启动/调用 | `cd review-lens && pnpm build`，Chrome → `chrome://extensions/` → 加载已解压的扩展程序 → 选 `review-lens/dist` |
| 测试命令  | `cd review-lens && pnpm test` |
| 验收工具  | 使用者本机 Chrome（宿主页需 CAS 登录态）+ Agent 侧 Vitest/jsdom 与 GitLab API 实测 |
| 访问入口  | `https://git.dev.sh.ctripcorp.com/hoteldynamicinfo/buyoutservice/-/merge_requests/27` |
| 前置数据  | 一条含「旧版本差异」主题、且作者后来真改过的 MR（上面这条即是） |

---

## 4. 留证命名规范

```
evidence/screenshots/M<N>-V<M>-<description>.png
```

本轮的真机截图由使用者在对话中提供，已归档到 `evidence/screenshots/`；测试类留证记录在 §5 的备注列。

---

## 5. 验收结果

| 编号 | 所属模块 | 状态 | 留证 | 备注 |
| ---- | -------- | ---- | ---- | ---- |
| V-1  | M1 | ✅ 通过 | `evidence/screenshots/M1-V1-entries-on-collapsed-threads.png` | 真机（使用者）。首次不通过：锚点错挂在 `.note` 上，折叠主题里没有 note 元素；改挂 `[data-discussion-id]` 后通过 |
| V-2  | M1 | ✅ 通过 | `evidence/screenshots/M1-V2-drawer-opened.png` | 真机 |
| V-3  | M1 | ✅ 通过 | `evidence/screenshots/M1-V2-drawer-opened.png` | 真机：`QueryFinanceInfoService.java` 锚点行 210 高亮 |
| V-4  | M1 | ⚠️ 部分 | 单测 `src/ui/__tests__/failure.test.js`（8 用例） | 五类失败态与出口均有单测覆盖；真机未构造出 401（cookie 鉴权一直可用），未拿到截图 |
| V-5  | M2 | ⚠️ 待真机 | 单测 `src/ui/__tests__/compare-view.test.js`、`src/core/__tests__/compare.test.js` | 逻辑与渲染有测试覆盖，使用者尚未回报真机截图 |
| V-6  | M2 | ⚠️ 待真机 | 同上 | 同上 |
| V-7  | M2 | ⚠️ 待真机 | 同上（含 commit 计数为 0 与 >0 两种文案） | 真机需碰到一条「至今未改动」的评论 |
| V-8  | M3 | ⚠️ 待真机 | 单测 `src/ui/__tests__/identifier-view.test.js`、`src/core/__tests__/identifier.test.js` | — |
| V-9  | M3 | ⚠️ 待真机 | 单测 `src/core/__tests__/related.test.js` | — |
| V-10 | M3 | ⚠️ 待真机 | 单测 `src/core/__tests__/method-range.test.js` | 含嵌套匿名类、字符串里的花括号、找不到边界退回片段 |
| V-11 | M4 | ⚠️ 待真机 | 单测 `src/ui/__tests__/save-card.test.js`、`src/core/__tests__/store.test.js` | 含连点两次只存一条、存储失败要说话 |
| V-12 | M4 | ⚠️ 待真机 | 单测 `src/popup/__tests__/cards-view.test.js` | — |
| V-13 | M4 | ⚠️ 待真机 | 单测 `src/core/__tests__/export.test.js` | 含代码内含三反引号时围栏自动加长 |
| V-14 | M5 | ✅ 主路径通过 | API 实测（页面内 `fetch('/api/v4/…')` 返回 200） | cookie 鉴权在内网实例实测可用，「开箱可用」成立；令牌回退路径为单测覆盖 |
| V-15 | M5 | ✅ 通过 | 测试 `tests/host-isolation.test.js`（4 用例） | history API 仍是原生、window 无新增属性、节点增量精确到 3 |
| V-16 | M5 | ✅ 通过 | 测试 `src/content/__tests__/i18n-dom.test.js`（3 用例） | 含「清空按钮文案后仍能挂载」 |
| V-17 | M1 | ✅ 通过 | `evidence/screenshots/M1-V17-replies.png` | 真机。首次不通过：回复渲染了但与首条评论视觉等价，使用者反馈「没看到回复」；加层级（底色/标题/竖线）后通过 |

**汇总**：17 条验收标准中，7 条已在真机或真实 API 上通过，10 条由单元/集成测试覆盖但等待真机确认。全量测试 180 用例通过。

---

## 6. 变更记录

| 版本 | 日期 | 变更内容 | 影响范围 |
| ---- | ---- | -------- | -------- |
| v1 | 2026-08-19 16:44 | 初版：M1–M5 全部模块完成后一次性建立验收计划与结果 | 全文 |
