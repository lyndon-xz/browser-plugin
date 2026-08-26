# 代码审查报告

## 审查范围

- 审查时间：2026-08-24
- 审查目标：`review-lens/` 全量 24 个 `.js`（`core/` 15、`ui/` 3、`content/` 2、`popup/` 3、`background.js`），共 2686 行。本报告只覆盖**行为与影响面**一层，写法层（结构、单元、语句、表意、样式、浏览器运行时约定）由分批报告另行出具。已跳过：`manifest.json` 等配置与图标（条款未覆盖，仅作为判定 content script 注入范围的上下文读取）；项目已按使用者决定删除全部单测，无测试文件可审。
- 审查依据：JS/TS 代码约定，本次覆盖 行为与影响面；lint 采信情况 未接入，仓库刻意零依赖、无构建、无 lint、无 TypeScript，全部条款转人工核对；被目标仓库关闭或判为不适用的规则 无（行为层条款本身不依赖机器信号）

## 结论

三侧（content script / service worker / popup）的协议、存储键与错误分类整体是自洽的，鉴权回退、写入串行化、失败态出口这些高风险处都能看出设计意图，且大多已按意图落地。真正的问题集中在**两侧对同一份数据的假设没对齐**：`buildComparePair` 允许 `unlocatable` 带 `then: null`，而抽屉的 ready 分支无条件读 `state.then`，一进这条路径就崩成「未知错误」；评论挂在被 MR 删掉的行上时会被判成「至今未改动，问题仍然成立」，结论与事实相反。另外两处 🔴 在设置页与令牌流向：读设置失败后用空壳兜底再写回，会静默清掉用户已存的令牌与站点列表；单一全局令牌没有站点归属，任何已注册站点（含 `http://`）只要回一个 401 就能拿到它。

建议处理顺序：先修两条 `core/compare.js` 与消费方的契约问题（用户可见、且发生在最该给结论的那两态），再修设置页的覆盖写，最后是令牌作用域。

本次没有 lint、tsc、单测中的任何一种可用，所有判定来自读逻辑与调用关系，**可靠性明显低于有机器防线的项目**：并发时序、GitLab 实例返回形态这类需要运行时验证的点，只能标进「未能确认」。若项目愿意在零依赖之外破一个例外，接一套 lint 的收益主要在写法层；行为层无论如何都靠人读，这一层的折扣补不上。

| 级别    | 数量 |
| ------- | ---- |
| 🔴 阻断 | 4    |
| 🟡 应改 | 8    |
| 🔵 优化 | 2    |

## 违规项

| 级别    | 文件:行号                                     | 违反的约定                                                             | 现状                                                                                                                                                                                                | 建议改法                                                                                                                          |
| ------- | --------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 阻断 | `review-lens/core/compare.js:100`             | 一个模块产出的每种结果形态，它的消费者都要真的处理得了                  | 锚点行不在该版本里时返回 `{ state: unlocatable, then: null }`；抽屉的 ready 分支无条件读 `state.then`（`ui/drawer.js:154` `then.methodName`、`:437`、`:549`、`:620`），直接抛 TypeError | 让这一态与 `:135` 那一态形态一致（如判不出片段就归到失败态并给出 `error.kind`），或在抽屉 ready 分支里显式处理 `then === null` |
| 🔴 阻断 | `review-lens/core/compare.js:110`             | 状态判别要覆盖它自己制造的分支组合，不能让某一支落到语义相反的结论上    | 评论挂在被删掉的行上时 `anchorSide === "old"`、锚点取自 `base_sha`（`:71`）；只要评论之后没有新推送，`thread.outdated` 为 false，就直接判 `unchanged`，界面说「这段代码就是当前分支上的样子，评论提的问题现在仍然成立」（`ui/drawer.js:372`）——而这段代码正是被这条 MR 删掉的 | `anchorSide === "old"` 时不能走 `!outdated` 这条捷径：要么按删除单独一态（右侧说明「这段代码已被这条 MR 删除」），要么强制走定位流程由 `locateInNewVersion` 判 `unlocatable` |
| 🔴 阻断 | `review-lens/popup/settings.js:114`           | 读取失败后不得拿空壳当真实状态写回，否则一次读失败会清掉用户已存的数据  | 读设置失败时兜底成 `settings = { extraOrigins: [] }`，页面仍可交互：点「保存」写 `token: tokenInput.value \|\| null`（`:51`）把已存令牌置空；点「添加站点」写 `extraOrigins: [origin]`（`:91`）把已有站点整体覆盖，被覆盖掉的站点仍在浏览器里注册着却再也无法从界面移除 | 读失败即进入只读态：禁用「保存」与「添加站点」，只留「重试读取」；或改成只提交用户本次真正改动过的字段，不基于未知的旧值整字段写回 |
| 🔴 阻断 | `review-lens/content/entry.js:100`            | 凭证只发给它所属的那个站点，作用域不随注入范围扩大                      | 令牌是设置里一个全局字段，content script 在任何已注册站点上都能读到它（`readToken`），并在该站点回 401/403 后作为 `PRIVATE-TOKEN` 发出（`core/gitlab.js:65`）；站点由用户自行添加、`IS_ORIGIN` 还放行 `http://`（`core/register-origin.js:14`），只要回一个 401 就能收到企业 GitLab 的令牌，且可走明文 | 令牌按 origin 存放并只发给同一 origin；同时把可添加站点限制为 `https://`，或在添加 `http://` 站点时明确拒绝令牌回退 |
| 🟡 应改 | `review-lens/core/thread.js:64`               | 上游响应的形态假设要有兜底，取不到就归成能说出原因的失败                | `mergeRequest.diff_refs.head_sha` 直接解引用，`entry.js:221` 同样；GitLab 在部分 MR 状态下 `diff_refs` 可能为 null，此时抛裸 TypeError，`error.kind` 为 undefined，界面只能显示「未知错误」 | 取不到 `diff_refs` 时抛一个带 kind 的错误（如 `unexpected` 并附「这条 MR 没有可比对的 diff」），让失败态说得出原因 |
| 🟡 应改 | `review-lens/core/thread.js:67`               | 逐条归一化的批量数据，一条异常不该让整批失败                            | `discussions.flatMap` 里 `toThread` 逐层解引用 `note.author.username`、`discussion.notes`、`position.*`；任一条讨论形态异常就让 `loadThreads` 整体抛错，落进 `loadError`，整页所有入口都只剩失败面板 | 单条归一化包一层，失败的那条跳过并计数（可在抽屉里提示「N 条讨论解析失败」），已成功的照常可用 |
| 🟡 应改 | `review-lens/core/thread.js:46`               | 翻页循环要有终止上限，不能只依赖上游一定按预期分页                      | `for (let page = 1; ; page += 1)` 只靠 `batch.length < PER_PAGE` 收尾；实例若忽略 `page` 参数而每次返回满页，循环不会结束，`all` 与客户端缓存持续增长 | 加页数上限（如 20 页）与到顶后的处理：截断并告知「讨论过多，只加载了前 N 条」 |
| 🟡 应改 | `review-lens/core/export.js:27`               | 同一个可选字段在所有消费者处按同一种可空性处理                          | 弹窗对没有 `webUrl` 的旧卡片专门不渲染回链（`popup/cards-view.js:57`），导出却直接插值，旧卡片导出成 `[Foo.java:32](undefined)` | 导出同样判空：无 `webUrl` 时只写 `文件:行号`，不产出坏链接 |
| 🟡 应改 | `review-lens/popup/cards-view.js:46`          | 面向用户展示的仓库名用人读路径，编码后的 API id 不进界面                | 卡片行的仓库名、筛选 chip、顶部统计（`:117`、`:122`、`:136`、`popup/popup.js:13`）都用 `source.project`，即 `encodeURIComponent` 后的 id，界面上显示成 `group%2Fsub%2Fproj`；`core/export.js:29` 已按「project 不该出现在笔记里」用 `projectPath` | 展示与筛选一律改用 `source.projectPath`，`project` 只留给 API 调用；旧卡片缺 `projectPath` 时按 `decodeURIComponent(project)` 兜底 |
| 🟡 应改 | `review-lens/popup/settings.js:103`           | 依赖异步初始化的界面，在数据到位前不该允许触发写操作                    | 顶层 `await ask(readSettings)` 之前就绑好了「添加站点」与「保存」；此时 `settings` 仍是 null，点添加走到 `settings.extraOrigins.includes` 抛 TypeError，落在异步处理器里无人接，页面一句提示都没有 | 初始渲染前禁用两个按钮，读回设置后再启用；或在 `addOrigin` 开头校验 `settings` 并给出「设置还在加载」 |
| 🟡 应改 | `review-lens/core/register-origin.js:30`      | 重复注入要真去重，去重依据要覆盖所有注入来源                            | 只比对动态脚本 id，未排除清单静态 `matches` 已覆盖的站点；用户在设置页添加 `https://gitlab.com`（清单里已有）会让 `content/bootstrap.js` 注入两次，同一页跑出两套 MutationObserver 与两轮 MR/讨论请求 | 注册前先比对清单静态 matches（或在设置页拦掉已覆盖的站点并提示「这个站点默认已支持」） |
| 🟡 应改 | `review-lens/content/entry.js:214`            | 重试成功后界面要更新到新结果，不能停在上一次的失败内容上                | 失败态的「重试」重取成功后调 `open({ discussionId })`，若该讨论不在代码讨论集合里（失败时入口是全量挂的），`if (!thread) return` 直接返回，抽屉仍显示旧的失败面板，用户看不出重试已经成功 | 这一支要渲染出结论，如渲染一个「这条讨论不是代码评论」的说明态，而不是静默返回 |
| 🔵 优化 | `review-lens/core/gitlab.js:99`               | 同一个缓存键只能唯一对应一种读法                                        | `cached` 只按 path 建键，`get`（json）与 `getText`（text）共用同一命名空间；当前两类路径不重叠，一旦重叠就会拿到另一种类型的结果 | 键里带上读法（如 `json:${path}` / `text:${path}`） |
| 🔵 优化 | `review-lens/core/attachment.js:20`           | 由外部正文决定的取数地址，放行范围要收到确实需要的那一类上              | 除 `/uploads/` 外，任何以宿主 origin 开头的地址都放行；`/uploads/../..` 也过得去 `UPLOAD_PATH`，等于评论作者可以让读者的浏览器对同源任意路径发 GET | 只放行 `/uploads/` 前缀且拒绝含 `..` 的路径，其余原样留成文本 |

## 既有债务

无。本次范围是指定目录而非 diff，全部代码都是审查对象，不存在「本次未改动」的区分。

## 未能确认的项

- **`extraOrigins` 与浏览器侧实际状态没有对账路径**：用户在 `chrome://extensions` 撤销站点权限、或动态脚本因故未能保留时，设置页列表照旧显示该站点，页面上却什么都不出现，也没有任何诊断出口。需要确认产品是否要处理这种「列表说有、实际没有」的漂移，以及要不要在设置页展示每个站点的真实注册/授权状态。
- **`outdated` 判定的实例前提**：`thread.js:64` 用 `position.head_sha !== diff_refs.head_sha` 表达「评论之后代码又动过」。若目标 GitLab 实例存在 diff 版本落后于源分支 tip 的窗口，这个判定会在窗口内给出 false。缺该实例的行为观测，无法定论。
- **`!thread.outdated` 分支里「没有动到这段代码」的依据**：`ui/drawer.js:374` 会说「评论之后有 N 个提交动过这个文件，但没有动到这段代码」，而这条分支从未计算过 diff，结论依赖「`outdated` 为 false 时提交数必为 0」这一前提。该前提是否在所有 MR 状态下成立，需要实例侧确认；若不成立，这句话会是无依据的断言。
- **抽屉里的设置快照时效**：`content/entry.js` 在建抽屉时读一次设置，之后设置页改宽度、视图、同步滚动都不会反映到已打开的页面。这是否算缺陷取决于产品预期（要求刷新即可，还是应当实时生效）。
