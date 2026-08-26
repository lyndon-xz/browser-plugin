# 代码审查报告

## 审查范围

- 审查时间：2026-08-24
- 审查目标：`review-lens/` 全量 24 个 `.js` 文件（`core/` 15、`ui/` 3、`content/` 2、`popup/` 3、`background.js`）。本报告覆盖**行为层与浏览器端运行时**两个维度，按影响面入口核对而非逐文件通读。已跳过：`manifest.json` 与图片（条款未覆盖的文件类型）、HTML（同）。单元测试已按 TD-11 从仓库移除，无需剔除。写法层（结构、单元设计、语句、表意、样式）分三批另行审查，尚未完成。
- 审查依据：JS/TS 代码约定，本次覆盖 行为与影响面（7 条）、浏览器端运行时（3 条）；lint 采信情况 **未接入，全部转人工核对**——该仓库刻意零依赖、无 eslint 与 tsc（TD-11），带规则 id 的条款只能靠读代码判定；被目标仓库关闭或判为不适用的规则：TypeScript 类型（无 TS）、React（无 React）两个模块整体不加载

## 结论

行为层有 4 项阻断问题，集中在两类：**凭证的流向没有按站点隔离**（为内网实例配的只读令牌会在另一个已注册站点上被发出去），以及**外部响应的形状被当成必然成立**（分页无上限、`diff_refs` 直接取属性，异常时抛出的是裸 `TypeError`，界面只能说「未知错误」）。另有一处让插件在真实 MR 页上静默不挂载的分支判定。副作用侧的共性是清理不完整：`bootstrap.js` 丢弃了 `init()` 返回的 teardown，GitLab 的 MR 页是客户端路由，切走后 observer、抽屉与 `document` 上的监听全部留存。

浏览器端运行时三条均合规或不适用：落盘字段是五个长期偏好、没有瞬时态混入；重新取数前已用一个不带 `then`/`now`/`diffOps` 的 loading 态清掉上一轮结果；本扩展没有批量写操作。

**结论的可靠性折扣**：本仓库未接入任何 lint 与类型检查，`custom/*`、`@typescript-eslint/*` 这类本可由机器给出确定信号的条款全部由人工核对，漏判概率显著高于有 lint 的项目。**建议先接入 lint**——即使保持产物零依赖，也可以把 eslint 放在 devDependencies 或用外部仓库的配置去 lint，两者都不会让扩展目录多出文件。

| 级别    | 数量 |
| ------- | ---- |
| 🔴 阻断 | 4    |
| 🟡 应改 | 2    |
| 🔵 优化 | 1    |

## 违规项

| 级别    | 文件:行号 | 违反的约定 | 现状 | 建议改法 |
| ------- | --------- | ---------- | ---- | -------- |
| 🔴 阻断 | `review-lens/core/gitlab.js:47` 配 `review-lens/core/store.js:11` | 凭证的读取范围与流向要最小化，只发给它被授予的那个来源 | 设置里只有一个全局 `token`，而 `createGitLabClient` 的 `origin` 取自当前页面（用户可在设置页添加任意站点）。为内网实例 A 配的只读令牌，在实例 B 上首次遇到 401 时会以 `PRIVATE-TOKEN` 头发给 B——等于把一个能读取全部私有仓库的凭证交给另一个主机 | 令牌按来源存：`tokens: { [origin]: token }`，`readToken` 只返回当前 origin 的那一个；设置页按站点分别填写。迁移时把已有的单值归到当前默认站点下 |
| 🔴 阻断 | `review-lens/core/thread.js:46-51` | 外部响应的形状不能当成必然成立，翻页要有终止上限 | `for (let page = 1; ; page += 1)` 没有页数上限，遇到忽略 `page` 参数的实例或中间代理会无限循环并无界追加 `all`；`all.push(...batch)` 在 `batch` 不是数组时（错误载荷）抛裸 `TypeError`，`error.kind` 为 undefined，界面落到「未知错误」 | 加页数上限（如 20 页），到顶即返回并在控制台记录；展开前先 `Array.isArray(batch)` 校验，不合形状时抛带 kind 的错误 |
| 🔴 阻断 | `review-lens/core/thread.js:64` | 跨边界字段的可空性要按实际可能取值处理，不能直接取下一级属性 | `mergeRequest.diff_refs.head_sha` 直接取属性，而 `diff_refs` 在不可 diff 的 MR（无提交、冲突严重）上为 `null`，抛裸 `TypeError`，同样落到「未知错误」 | 判空后抛 `GitLabRequestError(notFound, …)`，让失败态说得出「这条 MR 取不到 diff 基准」 |
| 🔴 阻断 | `review-lens/core/page.js:9` | 主判据取不到预期值时要退到备用判据，不能直接判定为「不是目标页面」 | `data-page` 存在但取值不同（实例改过模板、GitLab 版本差异、diffs 视图另有标签）时直接 `return false`，不再走已经写好的路径兜底 `MERGE_REQUEST_PATH`。结果是插件在真的 MR 页上静默不挂载，且没有任何日志出口 | 改成 `dataPage === MERGE_REQUEST_PAGE \|\| MERGE_REQUEST_PATH.test(location.pathname)`，两个判据取或 |
| 🟡 应改 | `review-lens/content/bootstrap.js:15` | 注册的观察者与监听要在对应时机清理，重复进入路径要去重 | `.then((entry) => entry?.init())` 丢弃了 `init()` 返回的 teardown。GitLab 的 MR 页标签切换是客户端路由：切走后 `MutationObserver`、抽屉、`document` 上的 keydown/mousedown 全部留存，工具栏图标也不复位（Chrome 只在跨文档导航时清 tab 级图标，SPA 导航不算），图标于是说谎 | 保存 teardown，监听 `popstate` 与被包装的 history 事件判断是否仍在 MR 页，离开即 teardown 并让 service worker 复位图标；重新进入时重新 `init()`（注意与 `ensureDrawer` 的并发保护一致） |
| 🟡 应改 | `review-lens/ui/drawer.js:247-258` 与 `:618-627` | 定时器要在组件销毁时清理 | 两处「滚动+闪一下」各自 `setTimeout(remove, 900)`，抽屉关闭后 timer 仍在跑（操作已分离的节点，无害但泄漏）；连点两个标识符时前一个 timer 会提前掐断后一次的闪烁 | 抽一个 `flashLine(lineNumber)`，用 `animationend` 而不是 `setTimeout` 移除 class（时长回归 CSS 单一来源），或把待清 timer 记下来在 `close()` 里 `clearTimeout` |
| 🔵 优化 | `review-lens/ui/drawer.js:300-321` | 写入 DOM 的外部 URL 要与同仓其它入口同一套校验口径 | `link.href = commit.web_url ?? "#"` 直接取接口字段，没有 origin/scheme 校验。GitLab API 是可信来源所以实际风险低，但这是全仓唯一未校验的 URL 写入，与 `core/attachment.js` 对 `/uploads/` 的严格白名单口径不一致 | 复用 `resolveAttachment` 的同源判断，或至少断言 scheme 为 http(s) |

## 既有债务

无。本次范围是指定目录、全部代码都是审查对象，不存在「本次未改动的既有代码」这一区分。

## 未能确认的项

1. **`locate.js` 按方法名定位时的同名歧义**：新版本里目标方法已删除、但同名方法存在于别处（重载、复制粘贴）时，现有实现取「行号最接近旧位置的一处」，可能定位到无关方法而界面表现为正常对照。判定这算不算 G1.1 违规需要知道产品期望：是宁可展示一个可能错的位置，还是宁可退回 `unlocatable`。缺的是产品口径，需要使用者澄清。
2. **`snapshot.js` 的 `SIGNATURE` 正则在超长单行上的回溯代价**：`[\w<>\[\],@.\s]*\([^;]*\)` 含可回溯的量词组合，压缩过的单行 Java 文件理论上可能触发显著回溯。未构造样本实测，也不清楚这个扩展是否会遇到压缩产物。缺的是实测数据。
