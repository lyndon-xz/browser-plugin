# review-lens 待修清单（阻断项）

由 `docs/review/` 下七份审查报告合并去重而成。每条注明来源报告与是否为本轮修复引入的回归。
七份报告本身不作废，修完在此处标注状态，也回写到对应报告里。

## 合并说明

跨报告重复的已合为一条（同一处问题被多轮独立查到时，取描述最完整的那份）：

- 令牌未按站点隔离：三轮行为层 + 我自己那份，共 4 次独立命中
- 游离 Promise：语句写法 + ui/content + popup/background，3 次独立命中
- `settings.js` 回车路径：语句写法 + 第三轮行为层 + popup/background，3 次独立命中

去重后 **11 条阻断项**，其中 **5 条是 2026-08-24 这轮修复引入的回归**（标 ⚠️）。

## 待修清单

| #   | 状态      | 位置                                                                                                                                                                                                            | 问题                                                                                                                                                                                                                                                                              | 改法                                                                                                                                                    |
| --- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 已修复    | `core/gitlab.js:47` + `core/store.js:11` + `content/entry.js:100`                                                                                                                                               | 设置里只有一个全局 `token`，而客户端 `origin` 取自当前页面（用户可加任意站点）。为实例 A 配的只读令牌，在实例 B 首次 401 时会以 `PRIVATE-TOKEN` 发给 B——等于把能读全部私有仓库的凭证交给另一个主机                                                                                | 令牌按来源存 `tokens: { [origin]: token }`，`readToken` 只返回当前 origin 那一个；设置页按站点分别填写；迁移时把已有单值归到默认站点下                  |
| 2   | 已修复    | `core/compare.js:110`                                                                                                                                                                                           | 评论锚在被本 MR 删掉的行上（`anchorSide === "old"`）且写于当前 head 时，`!thread.outdated` 直接判 `unchanged`，界面断言「这段代码就是当前分支上的样子」——而那一行在当前分支已不存在。产品最核心的一句结论说反                                                                     | `!thread.outdated` 的早退分支要按 `anchorSide` 分情况：旧侧锚点必须走定位流程，不能跳过比对直接判未改动                                                 |
| 3   | ⚠️ 已修复 | `core/compare.js:100` + `ui/drawer.js:154`                                                                                                                                                                      | 本轮为「越界锚点静默产出空代码区」新增了 `{ state: unlocatable, then: null }` 返回分支，而 ready 分支的 `describeSelection`/`renderPanes`/`renderFoot` 都无条件读 `state.then`，抛裸 `TypeError` → 界面退化成「未知错误」。与第 4 条串起来即：任何图片评论点开都是「未知错误」    | ready 分支先判 `state.then === null` 走 unlocatable 渲染；或让 compare 在这种情形下仍给出可读的 `then`（只是不给 `now`）                                |
| 4   | 已修复    | `core/thread.js:7`                                                                                                                                                                                              | `isCodeComment` 未排除 `position_type !== "text"`，图片/文件级 DiffNote 被当代码评论，产出 `anchorLine` 为空的 thread 并照样挂入口                                                                                                                                                | 判定加 `note.position.position_type === "text"`；同时该函数名承诺布尔却返回 `position` 对象，一并改成真布尔                                             |
| 5   | 已修复    | `core/thread.js:46-51`                                                                                                                                                                                          | `for (let page = 1; ; page += 1)` 无页数上限，遇到忽略 `page` 的实例或代理会无限循环并无界追加；`all.push(...batch)` 拿到错误载荷抛裸 `TypeError`，界面只能说「未知错误」                                                                                                         | 加页数上限（如 20 页）到顶即返回并记录；展开前 `Array.isArray(batch)` 校验，不合形状时抛带 kind 的错误                                                  |
| 6   | 已修复    | `core/thread.js:64`                                                                                                                                                                                             | `mergeRequest.diff_refs.head_sha` 直取属性，而 `diff_refs` 在不可 diff 的 MR 上为 `null`                                                                                                                                                                                          | 判空后抛 `GitLabRequestError(notFound, …)`，让失败态说得出「这条 MR 取不到 diff 基准」                                                                  |
| 7   | 已修复    | `core/page.js:9`                                                                                                                                                                                                | `data-page` 存在但取值不同（实例改过模板、版本差异、diffs 视图另有标签）时直接 `return false`，不走已写好的路径兜底 → 插件在真的 MR 页上静默不挂载                                                                                                                                | 改成 `dataPage === MERGE_REQUEST_PAGE \|\| MERGE_REQUEST_PATH.test(location.pathname)`                                                                  |
| 8   | 已修复    | `core/export.js:27`                                                                                                                                                                                             | `source.webUrl` 的可空性两侧相反：弹窗侧明确防御旧卡片没有它，导出侧无条件拼进 Markdown 链接 → 旧卡片导出成 `](undefined)`。同一处还有：导出是批量操作却全成全败、失败不点名到具体卡片                                                                                            | 导出侧同样兜底（无 `webUrl` 时不生成链接）；逐卡片记录结果，失败点名到具体卡片                                                                          |
| 9   | ⚠️ 已修复 | `ui/drawer.js:90,399,472,535,543` + `content/entry.js:151-158,206` + `popup/settings.js:103,105`                                                                                                                | 本轮接持久化入口时写的 `writeWidth: (w) => writeSettings(...)` 等四处返回 Promise 却被当同步回调调用；`onRetry` 里裸调 `open()`；回车裸调 `addOrigin()`。这些最终都落到 `ask()` 上，service worker 冷启动时最易抛——表现是「设置看起来改了、其实没存下」加一条无人处理的 rejection | 每个 Promise 都要被消费：`await`、接 `catch` 给用户可见的提示，或显式 `void` 且被调方自己已处置失败                                                     |
| 10  | ⚠️ 已修复 | `popup/settings.js:114`（守卫在 `try` 外，另见 `:49`）                                                                                                                                                          | 本轮为「顶层 await 失败让弹窗变空壳」加的降级 `settings = { extraOrigins: [] }`：页面仍可交互，点「保存」就把原本存着的令牌清成 `null`。且两道守卫落在 `try` 之外，`settings` 为 `null` 时 `settings.extraOrigins.includes(...)` 直接抛                                           | 降级状态不得写回存储：读失败时禁用保存与添加入口；守卫移进 `try` 内或先判 `settings` 是否已就绪                                                         |
| 11  | ⚠️ 已修复 | `ui/drawer.js:12` + `ui/drawer.css:30`；`ui/drawer.js:534-535`；`ui/drawer.js:277,659` + `ui/drawer.css:417`；`core/store.js:13` + `ui/drawer.js:14`；`content/entry.js:94` vs `:146,:230` + `ui/drawer.js:610` | 五组「同一份值两处来源」：最小宽度 420（JS + CSS）、步长 10（文案 + 逻辑，相邻两行）、闪烁时长 900（两处 JS + CSS）、默认宽度 820（存储 + UI）、可注入的 `origin` 参数被三处直接读 `window.location.origin` 绕过                                                                  | 各收敛为一个来源：420 与 900 由 CSS 自定义属性提供、JS 读取；10 抽 `WIDEN_STEP` 并让文案用模板串引用；820 由存储层作为唯一来源；`origin` 一律走注入参数 |

## 我引入的 5 条回归说明

第 3、9、10、11 条中的 `origin` 绕过、以及 `register-origin.js` 吞掉移除失败（🟡，未列入本表）都是 2026-08-24 这轮「按审查报告修复」时引入的。四轮修复引入九个新问题，全是同一类：**只看被修的那一处，没看它对上下游的影响**。

这是删掉 265 个测试之后的直接账单（TD-11）。静态核对能查语法与引用断裂，查不出「新增的返回分支没人处理」「新接的回调返回 Promise 没人消费」「降级状态被写回存储」这类。修这批时必须每改一处就回头 grep 它的所有消费者。

## 补记（2026-08-25）

11 条阻断项已全部修完并通过静态核对与 Node 实跑验证。此后又补审了此前未覆盖的三个模块
（结构与依赖、单元设计、样式，报告在 `review-lens-structure-style.md`），**69 条条款现已全部覆盖**，
补审发现的 8 条（0 🔴 / 6 🟡 / 2 🔵）也一并修完：四组状态机取值收敛为具名常量、`side` 到改动类别的
三份散映射并成一张表、8 个零引用导出收窄、消息表键序对齐协议、三处 import 组内字母序、
`z-index` 收口成 `--layer-top`、裸色值收敛为 token、默认视图交给 UI 层。

另修完三条跨报告的 🟡：`entry.js` 里描述别处工作的注释与它下面那段冗余去重（`thread.js`
已保证一个讨论只产出一条）、三个承诺布尔却不是布尔的名字（`IS_ORIGIN`/`IS_TYPE_NAME` → `*_PATTERN`）、
`note` 一词多义（拆成 `selectionNote` / `noteInput`）。

**SPA 路由 teardown 也做完了**：`bootstrap.js` 重写为跟随客户端路由挂载与卸载——包装
`pushState`/`replaceState`、监听 `popstate` 与 `pagehide`，离开 MR 页即 teardown 并通过新增的
`pageInactive` 消息让 service worker 复位工具栏图标（Chrome 只在跨文档导航时自动清标签页级图标）。

### 两类系统性写法（2026-08-25 二轮）

**入参在函数签名里解构 —— 11 个函数全部改完。** 报告里记的「24 处」是解构出的属性个数，
按函数算是 11 个：`relatedLines`、`locateInNewVersion`、`createGitLabClient`、`request`、
`renderFailure`、`renderLine`（两个参数都解构）、`attachEntries`、`init`、`createDrawer`、
`bootstrap` 里的 then 回调。带默认值的两个注入口（`init`、`createDrawer`）改成
`function init(overrides = {})` + 函数体首部 `const { … } = overrides;`，默认值照旧生效。

**自造布尔缺判断式前缀 —— 能改的都改完，一个明确不改。**
已改：`worthIt` → `isWorthLinking`、`fits` → `isWithinWholeMethodLimit`、
`tokenAccepted` → `hasAcceptedToken`、`outdated` → `isOutdated`（这是我们自己按
`head_sha !== mrHeadSha` 算的，不是 GitLab 原字段，改名不动外部契约）、
`wholeMethod` → `isWholeMethod`、`code-pane` 里的 `changed`（是行号 Set）→ `changedLines`。

**`syncScroll` 不改。** 它和 `tokens`、`view`、`drawerWidth`、`extraOrigins` 一样是设置项的
名字——名词短语说明「这个开关是什么」，不是把布尔伪装成动作；而它已经落在用户机器上，
改名要么静默丢值要么永久留一段迁移代码。判断式前缀这条约束的是被当判据读的局部变量，
不是存储契约里的开关键。

**顺带修掉两处非命名问题。** 一是改动行数双计（`ui/drawer.js`）：原先数
`op.type !== "keep"` 的个数，而一处逐行替换会同时产生 remove 与 add 两个 op，「改了 1 行」
被说成 2 行；改成取两侧受影响行数的较大值，实跑验证一处替换算 1 行、改两行算 2 行。
二是 `ui/code-pane.js:85` 那条声称「快照行号减去起始偏移即得」的注释——它下面一行
从来没减过任何偏移，`changedRows` 存的就是文件绝对行号，注释删掉。

**补上一处我自己引入的回归。** 上一阶段把单值 `token` 改成按站点隔离的 `tokens` 时没做迁移，
用户已配的令牌升级后会静默读不到。现在 `readSettings` 会识别旧形态：旧值无法安全归属
（猜错就把令牌发往别的站点，正是隔离要防的事），所以不猜、也不静默丢——去掉旧键并留
`needsTokenReentry` 标记，设置页据此提示「旧版令牌已停用，请选择站点后重新填写」。

~~仍未做：`recess-order`、接入 lint。~~ **两条已于 2026-08-25 完成**，见
`code-review-review-lens-lint.md`：借 `frontend-code-spec` 的规则集从外部 lint 本仓库
（扩展目录仍零依赖、未新增文件），`recess-order` 30 处一次 `--fix` 修完。同一轮还由机器信号
补出两条静态审查漏掉的 🔴：`ui/drawer.js` 的裸块导致整个文件语法错误，以及 manifest 里
`use_dynamic_url` 让 ES 模块无法加载——后者使插件在任何站点上都挂不起来。

## 非阻断项去哪儿看

🟡 应改与 🔵 优化共 130 余条，分散在七份报告里，按领域查：

| 报告                              | 覆盖                       | 🟡 / 🔵 |
| --------------------------------- | -------------------------- | ------- |
| `review-lens-behavior.md`         | 行为与影响面（三轮合并）   | 16 / 3  |
| `review-lens-core.md`             | `core/` 全模块 54 条       | 36 / 11 |
| `review-lens-ui-content.md`       | `ui/` + `content/`         | 26 / 8  |
| `review-lens-popup-background.md` | `popup/` + `background.js` | 17 / 6  |
| `review-lens-statements.md`       | 语句写法（全量 24 文件）   | 25 / 17 |
| `review-lens-expression.md`       | 表意（全量 24 文件）       | 29 / 5  |
| `review-lens-conventions.md`      | 我自己核对的部分           | 2 / 0   |

`review-lens-behavior-by-main.md` 是我独立做的那份行为层审查，保留用于对照：同一份条款，独立视角比我多查出三条 🔴，其中一条是我自己刚引入的。

尚未覆盖：结构与依赖 + 单元设计（另有一轮在跑）、样式（另有一轮在跑）。

## 全局建议

~~**接入 lint。**~~ **已做（2026-08-25）**：借 `frontend-code-spec` 的规则集从外部 lint，扩展目录保持零依赖。复现命令写在 `code-review-review-lens-lint.md` 文末。结论如七份报告所预期——机器一次给出了人工漏掉的两条 🔴 与 65 处形态偏离。

## 分层收尾与 content 拆分（2026-08-25，已修）

| 位置                                          | 问题                                                                                                                                                                        | 改法                                                                                                                                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/code/snapshot.js`                       | 混了 IO 与纯函数：`loadFile` 要 client、发 GitLab 请求，而切片与找方法边界是纯计算。放在 `code/` 让这一层不再「纯」                                                         | `loadFile` 移到 `core/gitlab/file.js`。`core/code/` 现在四个文件全是纯函数                                                                                                                  |
| `content/entry.js` 304 行                     | `init()` 一个函数里塞了注入口装配、抽屉懒建、讨论取数与缓存态、渲染流程、入口挂载——和拆分前的 `drawer.js` 同一种形态                                                        | 拆成 `entries.js`（入口挂载，只认 DOM）、`threads.js`（评审数据与对照基准）、`drawer-bridge.js`（抽屉懒建与偏好桥接）、`run-detached.js`（发出去不等它的形态），`entry.js` 只留编排，161 行 |
| `manifest.json` 的 `web_accessible_resources` | 只列了 `content/entry.js` 一个文件。拆出新模块后它的模块图里有四个不可访问的文件，**动态 import 整个失败、插件在任何站点都挂不起来**                                        | 改成 `content/*.js`。这类问题静态检查查不出来（文件都存在），只有真实加载才暴露                                                                                                             |
| `content/entries.js` 的卸载                   | `detach()` 只断开 observer，已挂的按钮留在页面上。宿主页是客户端路由、节点可能不重建，留下的按钮点开的是上一轮闭包（旧 client、旧讨论数据），下一轮挂载还会在同一处再加一个 | 卸载时一并 `remove()` 掉所有 `.review-lens-entry`。端到端验证里 `afterTeardown.entries` 从 1 变 0                                                                                           |

## 拆分之后补发现的两处（2026-08-25，已修）

| 位置                                            | 问题                                                                                                                                                                                                                           | 改法                                                                                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `popup/settings.js` 的 `BUILT_IN_ORIGINS`       | 与 `manifest.json` 的 `content_scripts.matches` 是同一份知识的两份副本，且已漂移：manifest 有 `http://git.dev.sh.ctripcorp.com/*`，设置页只列 https 那个。插件在 http 站点上挂得出入口，用户却无法给它配令牌，401 之后没有出路 | 站点列表改从 `chrome.runtime.getManifest()` 的 `content_scripts.matches` 推导。顺带修了标签：原先去掉协议前缀会让同一主机的 http/https 两条显示成一模一样，现在只省略 `https://` |
| `ui/drawer.css`、`popup/popup.css` 的 11 处注释 | 上一轮注释收敛只过了 `.js`，CSS 注释里的 `DD-41`/`DD-44`/`design.md §2` 这类文档编号引用漏掉了                                                                                                                                 | 判据留下、编号去掉。现在全仓 `.js` 与 `.css` 都不再引用设计文档编号                                                                                                              |

## 仍在台面上的（2026-08-25 收尾核对）

| 项                                                 | 状态                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 带登录态的内网 MR 页端到端回归                     | **未做，需要你**。gitlab.com 未登录取不到 discussions，「入口按钮挂上 → 打开抽屉 → 两栏对照」这条主链路只在组件级验证过                                                                                                                                                                                                                                                                                                                                     |
| ~~`ui/drawer.js` 单文件 774 行、闭包内 31 个函数~~ | **已拆（2026-08-25）**。`ui/drawer.js` 只留编排（216 行）：持有全部可变状态，渲染分成 `ui/drawer/` 下的 shell / verdict / comment-card / panes / foot 五个模块（另有 code-pane、failure、date），全是纯函数——接数据与回调、返回 DOM，不持有状态。跨段协作走回调：评论里的 chip 点击经 `onJumpTo` 回编排层再调 `flashLine`，两栏右侧摆什么由 `renderRight` 传入，笔记与「已存」经 `onNoteChange` / `onSaved` 回写。「谁能改状态」从 31 个函数收敛到 1 个文件 |
| 七份报告里 🟡/🔵 的逐条核销                        | **仍未逐条对账**，但 drawer.js 相关的语义类条目已随拆分核销：职责过重（已拆）、`view` 一词二义（`entry.js` 里指抽屉实例的那个已并回模块级 `drawer`，不再遮蔽也不再与视图模式撞词）、`target` 二义（`loadFile` 的入参改 `fileRef`，`target` 只留给要写入的 DOM 容器）、`rail` 与 class 名不一致（改 `paneSpine` 对齐 `.pane-spine`）、`hits` 泛化命名（全链路改 `hitIdentifiers`）。420 与 900 两处值确认各只有一个来源                                      |
