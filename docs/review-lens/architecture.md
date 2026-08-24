# 技术架构

## 1. 技术选型

| 层             | 技术                                                                | 选择理由                                                                                                  |
| -------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 运行平台       | Chrome 扩展 Manifest V3（content script + service worker + popup）  | 唯一能在别人的页面里注入 UI 又能读跨源存储的形态；与同仓 `search-sort` 一致                                |
| 开发语言       | 原生 JavaScript（ES modules）                                       | 产物零构建，改完刷新即生效；同仓既有插件也是原生 JS，不引入新的心智负担                                     |
| UI 框架        | 无框架，原生 DOM + Shadow DOM                                       | 界面只有一个抽屉和一个弹窗，框架的收益不抵它带来的构建步骤；Shadow DOM 用来与宿主页样式隔离                 |
| 状态管理       | 无库：每个抽屉实例一个 state 对象 + 单向 `render(state)`             | 状态规模是「一条评论 + 两份代码快照」，一个对象足够；不引 store 免得为 20 行状态搭一套框架                  |
| 样式/UI 组件库 | 单文件 CSS + CSS 变量，注入 Shadow DOM                              | 视觉 token 已在 design.md 定稿，直接落成变量；无组件库依赖                                                 |
| 后端/服务      | 无自建后端，数据源为宿主实例的 GitLab REST API v4                   | 需要的数据 GitLab 自己全都有，加一层服务只会多一处要维护和一处要鉴权                                        |
| 数据存储       | `chrome.storage.local`                                              | 学习卡片与设置都是单机数据，量级在 MB 内；与 `search-sort` 一致                                             |
| 构建/打包/分发 | 零依赖复制式构建 `node scripts/build.js`：`src/` → `dist/`，剔除测试文件 | 不引 bundler、不做转译，只解决一件事：让 Chrome 拿到的目录里没有测试与依赖（Chrome 拒绝 `_` 开头的名字）。代价是改完要先 build 再重新加载，`pnpm dev` 起 watch 抵消 |
| 测试框架       | Vitest + jsdom，用例就近放 `__tests__/`                             | 抽屉是 DOM 密集的（Shadow DOM、行渲染、滚动同步），`node:test` 无 DOM 环境测不了；Vitest 只进 devDependencies |
| 部署方式       | 本地未打包加载；后续如需分发再打 zip                                | 单人自用工具，先不进应用商店（要过审、要公开源码信息）                                                     |

> 编号规则：TD = Tech Decision（技术决策），如 TD-1、TD-2

| ID   | 决策                                                                                                       | 备选方案                                              | 理由                                                                                                                                                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TD-1 | 薄 bootstrap content script（非 module）做站点判定，随后动态 `import(chrome.runtime.getURL(...))` 引导 ESM 主模块 | 全部沿用 `search-sort` 的「manifest js 数组顺序注入 + 共享全局作用域」 | MV3 的 `content_scripts.js` 不支持声明成 module，但**支持动态 import**。全局注入那套写法没法被 Vitest 直接 `import` 测，而本 skill 要求先写失败测试；为可测性付一层 bootstrap 的代价是值得的。需在 `web_accessible_resources` 声明被 import 的文件 |
| TD-2 | 鉴权默认复用宿主页的 `_gitlab_session` cookie（同源 `fetch`，只读 GET），401/403 才落回用户配置的 PAT      | 一上来就要求填 PAT                                    | GitLab 官方文档明确「登录后设置 `_gitlab_session`，API 在该 cookie 存在时用它鉴权，主要使用者是 GitLab 自己的前端」；同源 `fetch` 默认带 credentials，只读 GET 不需要 CSRF token。这样才能做到 V-14 的开箱可用            |
| TD-3 | 「评论时版本」取自 `position.head_sha`：`GET /repository/files/:path/raw?ref=<head_sha>`                     | 解析 MR 的 diff 版本接口                              | 已在真实 MR 上实测：每条 DiffNote 的 `position` 带 `base_sha` / `start_sha` / `head_sha` / `new_path` / `old_path` / `new_line`，且不同评论的 `head_sha` 不同——它就是「这条评论写下时 MR 的 head」。据此能精确还原评论者当时看到的文件 |
| TD-4 | 「这条评论是否已被后续 commit 改过」判据：`position.head_sha !== mr.diff_refs.head_sha`                      | 解析页面上的「旧版本差异」标记                        | 判据在数据里而不是在 DOM 文案里，不受 GitLab 界面语言与版本影响（V-16 也依赖这一点）                                                                                                                                     |
| TD-5 | 两份代码的差异在前端算：自写行级 LCS diff（约 60 行，纯函数）                                                | 调 `GET /repository/compare` 拿 unified diff 再解析     | compare 返回的是整个 commit 区间的 unified diff，还得自己定位文件、截取片段、映射行号，解析成本高于直接算；纯函数版本好测（TDD 的第一批用例就在这里）                                                                      |
| TD-6 | 抽屉挂在 `document.body` 末尾的宿主节点上，内部用 Shadow DOM (`mode: 'open'`)                               | 强命名空间前缀 + `!important`                          | 宿主页样式改动不该让抽屉变形（design.md §7 的硬约束）；用 `open` 而非 `closed` 是为了测试能进去断言                                                                                                                       |
| TD-7 | 站点与页面判定用 `document.body.dataset.page === 'projects:merge_requests:show'`                             | 匹配 URL 正则 `/-/merge_requests/\d+`                  | GitLab 用 `body[data-page]` 标注当前控制器动作，比 URL 正则更能同时判定「是 GitLab」与「是 MR 讨论页」，也不受实例部署在子路径下的影响。**待 M1 在内网实例上确认该属性存在**（见 §6.3 待验证项）                          |
| TD-8 | project 标识直接用 URL-encoded 的 `namespace/project`，不额外查 project id                                   | 从页面读 `data-project-id`                            | 已实测：`IBUHotelFrontEnd/htl-multi-detail-page` 这种路径形式可直接作为 `:id` 调 API 成功，省掉一次查 id 的请求，也少依赖一个 DOM 属性                                                                                    |
| TD-10 | 走一层复制式构建：源码在 `src/`（测试就近 `__tests__/`），Chrome 加载 `dist/` | 让 `src/` 直接可加载（把测试与依赖挪出插件目录）；或干脆不写测试 | Chrome 会把被加载目录整棵树收进扩展，只要任一层出现 `_` 开头的名字就拒绝加载，而第三方包普遍自带 `__tests__`/`__mocks__`，所以只要 `node_modules` 在被加载目录里就早晚撞上。构建产物隔开这一切，源码组织不必为 Chrome 的限制让步 |
| TD-9 | `content_scripts.matches` 只默认包含内网 GitLab 与 `gitlab.com`，其余站点由用户在设置里添加，走 `optional_host_permissions` + `chrome.scripting.registerContentScripts` 动态注册 | 直接 `<all_urls>`（`search-sort` 就是这么做的）        | 本插件会读代码内容，注入面越小越好；`<all_urls>` 意味着在任何网站都跑一段脚本，对一个「读内网代码」的工具是不必要的权限。这是本插件与 `search-sort` 有意的分歧                                                             |

---

## 2. 架构总览

数据只有一个方向：宿主页负责「哪条评论」，GitLab API 负责「代码长什么样」，抽屉只渲染。没有服务端，没有后台轮询，service worker 只做三件不能在 content script 里做的事（存储读写、跨标签页广播、打开设置页）。

```
GitLab MR 讨论页（宿主）
 │
 │ ① bootstrap.js（非 module）判定 body[data-page]，命中才继续
 ▼
content/entry.js ── 扫描 DiffNote 节点，挂「解读」入口 ─────────┐
 │                                                             │
 │ ② 点击：从 DOM 只取 discussionId / noteId                    │
 ▼                                                             │
core/thread.js ── 调 API 拿这条 discussion 的 position ────────┤
 │                                                             │
 ├─ core/snapshot.js  取 then 版本（ref = position.head_sha）   │  统一走
 ├─ core/snapshot.js  取 now 版本（ref = mr.diff_refs.head_sha）│  core/gitlab.js
 ├─ core/diff.js      行级 LCS → diffOps                       │  （鉴权 + 缓存 +
 └─ core/identifier.js 从评论正文提标识符 → 命中行              │   错误归类）
 │                                                             │
 ▼                                                             │
ui/drawer.js（Shadow DOM）渲染 state ──────────────────────────┘
 │
 └─ 存卡片 ─→ chrome.runtime.sendMessage ─→ service worker ─→ chrome.storage.local
                                                     ▲
                                        popup/（卡片列表、筛选、导出 Markdown）
```

一次「点入口 → 看到对比」要发 4 个请求（MR 元信息、discussions、then 文件、now 文件），其中前两个按 MR 缓存、后两个按 `sha + path` 缓存，所以同一个 MR 里读第二条评论通常只剩 1–2 个请求。缓存放内存（Map），不落盘——代码内容不该在磁盘上留副本。

---

## 3. 模块划分

### 3.1 内部模块

| 模块              | 职责                                                              | 关键文件                                             | 模块间接口/依赖                                                    |
| ----------------- | ----------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| bootstrap         | 站点/页面判定，动态 import 主模块                                 | `content/bootstrap.js`                               | 无依赖；判定失败即返回，不产生任何副作用                            |
| 入口注入          | 扫描 DiffNote 节点、挂按钮、监听新增评论                          | `content/entry.js`                                   | → `ui/drawer.js`；只从 DOM 取 id，不从 DOM 取代码                   |
| GitLab 客户端     | 鉴权（cookie→PAT 降级）、请求、内存缓存、错误归类                 | `core/gitlab.js`                                     | ← 所有取数模块；对外只暴露 `get(path)` 与归类后的错误              |
| 讨论解析          | discussion → `ReviewThread`（含 position、outdated 判定）          | `core/thread.js`                                     | → `core/gitlab.js`                                                 |
| 代码快照          | 取某个 sha 下的文件、按锚点裁片段、定位方法体边界                 | `core/snapshot.js`                                   | → `core/gitlab.js`                                                 |
| 差异计算          | 行级 LCS，输出 `diffOps`（keep/add/remove）                        | `core/diff.js`                                       | 纯函数，无依赖                                                     |
| 标识符提取        | 从评论正文提 Java 标识符，回代码里找命中行                        | `core/identifier.js`                                 | 纯函数，无依赖                                                     |
| 抽屉 UI           | Shadow DOM 挂载、`render(state)`、视图切换、滚动同步、宽度记忆    | `ui/drawer.js`、`ui/code-pane.js`、`ui/drawer.css`    | ← 入口注入；→ `messages.js`（存卡片）                              |
| 卡片存储          | 卡片 CRUD、设置读写、Markdown 导出                                | `core/cards.js`、`core/settings.js`                   | → `chrome.storage.local`（经 service worker）                       |
| service worker    | 存储读写、设置页打开、动态注册额外站点                            | `background.js`                                      | ← content script / popup 的消息                                    |
| 弹窗              | 卡片列表、筛选、删除、导出                                        | `popup/*`                                            | → `core/cards.js`                                                  |
| 消息协议          | 三端共享的 action 常量                                            | `core/messages.js`                                   | 被三端 import（沿用 `search-sort/utils/message.js` 的做法）          |

模块与需求模块的对应：M1 = bootstrap + 入口注入 + GitLab 客户端 + 讨论解析 + 代码快照 + 抽屉 UI 骨架；M2 = 差异计算 + 抽屉双栏/堆叠视图；M3 = 标识符提取 + 方法体边界；M4 = 卡片存储 + 弹窗；M5 = 鉴权降级 + 动态站点注册 + 中英文 DOM 兼容。

### 3.2 依赖的 GitLab REST 端点

只读，全部 GET。`:id` 为 URL-encoded 的 `namespace/project`（TD-8）。

| 端点                                                            | 用途                                    | 关键返回字段                                                   | 对应验收       |
| --------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------- | -------------- |
| `/merge_requests/:iid`                                          | 当前 head、目标分支                     | `diff_refs.head_sha`、`target_branch`                          | V-5、V-7       |
| `/merge_requests/:iid/discussions`                              | 评论与其代码位置                        | `notes[].type='DiffNote'`、`notes[].position`、`resolved`       | V-1、V-2、V-3  |
| `/repository/files/:path/raw?ref=<sha>`                         | 某个 commit 下的文件全文（then / now）  | 文件原文                                                       | V-3、V-5、V-10 |
| `/repository/commits?path=<file>&ref_name=<branch>&since=<ts>`  | 评论之后有多少 commit 碰过这个文件      | commit 列表长度                                                | V-7            |

实测得到的 `position` 形状（取自真实 MR 的一条 DiffNote）：

```json
{
  "base_sha": "edc9f5b7e57fdb3a96b67e8b76d43615735ea896",
  "start_sha": "edc9f5b7e57fdb3a96b67e8b76d43615735ea896",
  "head_sha": "55c3bb54b7fa132454a6e47d6eb46f128e1f00d1",
  "position_type": "text",
  "new_path": "src/modules/.../hotelDescription.collector.ts",
  "old_path": "src/modules/.../hotelDescription.collector.ts",
  "new_line": 23
}
```

两条实测结论直接落成实现约束：

- 只有 `type === 'DiffNote'` 且 `position !== null` 的 note 才挂入口。系统消息（`system: true`，如"added 1 commit"）与整体评论的 `position` 都是 `null`，天然被这一条判据排除。
- `new_line` 与 `old_line` 只会有其一（该行只存在于新版或旧版时另一个缺失），取锚点行必须两者都处理。

---

## 4. 数据模型

### 4.1 内存实体

| 实体           | 字段                                                                                                    | 说明                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `ReviewThread` | `discussionId`、`noteId`、`author`、`createdAt`、`body`、`resolved`、`position`、`outdated`               | `outdated` 由 TD-4 算出，决定 now 栏是对比还是"至今未改动"   |
| `CodeSnapshot` | `sha`、`path`、`lines[]`、`anchorLine`、`rangeStart`、`rangeEnd`                                          | 片段视图与完整方法体视图共用，靠 `rangeStart/End` 区分       |
| `ComparePair`  | `then: CodeSnapshot`、`now: CodeSnapshot \| null`、`untouchedCommits: number \| null`、`diffOps[]`        | `now` 为 `null` 时必须有 `untouchedCommits`，两者不同时缺失   |
| `Identifier`   | `text`、`matchedLines[]`、`reason`                                                                       | `reason` 是"为什么算命中"，直接显示在相关行浮层里            |

`ComparePair` 刻意不设 `isUntouched` 布尔：`now === null` 已经表达了这件事，多一个布尔就多一处要同步。

### 4.2 `chrome.storage.local`

```jsonc
{
  "settings": {
    "token": null,              // PAT，仅在 cookie 鉴权不可用时才有值
    "view": "stacked",          // stacked | side，抽屉视图记忆
    "drawerWidth": 820,         // px，拖拽后记住
    "extraOrigins": []          // 用户额外添加的 GitLab 站点（TD-9）
  },
  "cards": [
    {
      "id": "c_1755600000000",
      "savedAt": "2026-08-19T11:20:00+08:00",
      "source": {
        "origin": "http://git.dev.sh.ctripcorp.com",
        "project": "hotel/buyoutservice",
        "mrIid": 812,
        "discussionId": "a56515dc…",
        "path": "…/BuyoutSettleMentService.java",
        "line": 41,
        "webUrl": "http://…/-/merge_requests/812#note_26712695"
      },
      "symbol": "getContractSummary()",
      "comment": { "author": "cp.tang", "createdAt": "…", "body": "…" },
      "thenCode": "…",
      "nowCode": null,           // null 表示至今未改动，与 ComparePair 同一口径
      "note": "取值前要判 getSuccess()，或用 Optional 兜一个空对象"
    }
  ]
}
```

`token` 落在 `storage.local` 而不是 `storage.sync`：同步会把令牌带到用户所有登录了 Chrome 的机器上。

---

## 5. 目录结构

插件在仓库里自包含：开发期依赖只装在插件自己目录下，仓库根保持干净。源码按职责组织、测试就近共置，Chrome 加载的是构建产物 `dist/`（TD-10）。

```
review-lens/
├── package.json               # devDependencies（vitest、jsdom）+ build / dev / test 脚本
├── vitest.config.js
├── node_modules/              # 装在插件内部，不进仓库根
├── scripts/build.js           # 零依赖：src → dist，剔除 __tests__ 与 *.test.js
├── src/                       # 源码，测试就近放 __tests__/
│   ├── manifest.json
│   ├── background.js          # service worker（ESM）
│   ├── content/
│   │   ├── bootstrap.js       # 非 module：判定 body[data-page]，命中才动态 import
│   │   ├── entry.js           # 扫描 DiffNote、挂入口、装配整条链路
│   │   └── __tests__/
│   ├── core/
│   │   ├── gitlab.js          # 鉴权与请求、内存缓存、错误归类
│   │   ├── page.js            # 页面判定与 project/mrIid 解析
│   │   ├── thread.js          # discussion → ReviewThread（含 outdated 判定）
│   │   ├── snapshot.js        # 取文件、裁片段、找方法体边界
│   │   ├── diff.js            # 行级 LCS → diffOps（纯函数）
│   │   ├── identifier.js      # 评论正文标识符 → 命中行（纯函数）
│   │   ├── cards.js           # 卡片 CRUD 与 Markdown 导出
│   │   ├── settings.js        # 设置读写
│   │   ├── messages.js        # 三端共享消息协议
│   │   └── __tests__/         # 含 fixtures/
│   ├── ui/
│   │   ├── drawer.js          # Shadow DOM 挂载与 render(state)
│   │   ├── code-pane.js       # 代码栏：行渲染、三个标记通道、滚动同步
│   │   ├── failure.js         # 失败态：机器原因 + 人话结论 + 出路
│   │   ├── drawer.css         # design.md 的视觉 token 落成变量
│   │   └── __tests__/
│   ├── popup/                 # popup.html / popup.css / popup.js / settings.js
│   └── icons/                 # 16/32/48/128
└── dist/                      # ← Chrome「加载已解压的扩展程序」指向这里；构建产物，已 gitignore
```

`search-sort/` 保持零依赖、无构建、目录直接可加载——它没有测试也没有依赖，不需要这一层。两个插件的差别只来自「有没有 devDependencies」。

---

## 6. 环境与部署

### 6.1 开发环境

- 依赖安装：`cd review-lens && pnpm install`（只有 devDependencies：`vitest`、`jsdom`）
- 跑测试：`cd review-lens && pnpm test`（`vitest --run` 单次模式，不进 watch）
- 构建：`pnpm build`（`src/` → `dist/`）；开发时 `pnpm dev` 起 watch，改完只需在扩展页点「重新加载」
- 加载扩展：`chrome://extensions/` → 开发者模式 → 加载已解压的扩展程序 → 选 `review-lens/dist`
- 环境变量：无。PAT 由用户在设置页填，不进代码也不进仓库

### 6.2 部署方案

不上商店。改完先 `pnpm build`（或让 `pnpm dev` 的 watch 自动跑），再在扩展页点一次「重新加载」；content script 的改动还需刷新宿主页。要分发就把 `dist/` 打成 zip。

### 6.3 待验证项（M1 第一批步骤要落地的）

| 项                                                                 | 现状                                                        | 不成立时的退路                                              |
| ------------------------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------- |
| 同源 `fetch('/api/v4/…')` 能否带 `_gitlab_session` 过内网实例鉴权 | 官方文档支持该方式；本机浏览器操作被拒，尚未在内网实例实跑 | 落回 PAT（TD-2 已设计，V-14 已覆盖）                        |
| `body[data-page]` 在内网 GitLab 版本上是否存在且值为预期            | **已实测成立**：MR 2797 上取值 `projects:merge_requests:show`（另有 `body[data-project-id]='121341'` 可用） | 无需退路                                                     |
| 入口按钮挂载点的 DOM 结构                                          | **已实测**：容器 `LI.note.note-wrapper.note-comment[data-note-id]`，插入点 `.note-actions` 存在 | 无需退路；「是否代码评论」已改由 API 的 DiffNote 集合判定     |
| 中英文界面下挂载点是否一致                                          | 未实测（只看到中文界面）                                    | 选择器与判定都不含文案，理论上不受语言影响；M5-S4 用两份 fixture 固化 |

这三项都不影响架构分层，只影响 M1 的具体选择器与降级路径，因此不阻塞本门禁——它们是 M1 走通骨架时第一批要打穿的东西（这也正是 M1 被定成 walking skeleton 的原因）。

---

## 7. 安全考虑

| 风险                                       | 处置                                                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 代码内容外泄                               | 全程不发第三方请求，只与宿主 GitLab 同源通信；本轮不接 AI（requirement §5.2），因此没有任何外发通道                |
| PAT 泄露                                   | 只存 `storage.local`（不 sync）、只在 `PRIVATE-TOKEN` 头里用、不写日志、不进导出的 Markdown                        |
| 注入面过大                                 | 默认只匹配两个 GitLab 站点，额外站点由用户显式添加并走 `optional_host_permissions`（TD-9），不用 `<all_urls>`      |
| 污染宿主页                                 | 只往 `body` 末尾加一个宿主节点 + 每条评论一个按钮；不改 history API、不加全局变量、不覆写宿主页事件（V-15 验收）    |
| 缓存把代码留在磁盘                         | 文件内容只进内存 Map，随标签页关闭消失；`storage.local` 里只有用户主动存的卡片                                    |
| 越权读到无权限项目                         | 不做任何权限判断，完全依赖 GitLab 自己的鉴权结果；403 直接如实显示（V-4）                                          |
| 导出的 Markdown 带内网信息                 | 导出是用户主动触发且落到本地文件；文件里包含内网 URL，属预期行为，但在导出提示里明说                              |

---

## 8. 变更记录

| 版本 | 日期             | 变更内容                                                                                                     | 影响范围 |
| ---- | ---------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| v1   | 2026-08-19 11:47 | 初版：定 MV3 + 原生 JS + Vitest 技术栈与 TD-1~TD-9；用真实 MR 实测 `position` 结构、确认 cookie 鉴权文档依据 | 全文     |
| v4   | 2026-08-20 16:45 | 测试布局按 write-unit-tests 的就近共置改正：撤掉包根 `tests/`，`build.test.js` 归 `scripts/__tests__/`、`register-origin` 归 `core/`、`host-isolation` 归 `content/` | §5 目录结构 |
| v3   | 2026-08-19 13:47 | 改走复制式构建（TD-10）：源码回到 `src/` 且测试就近共置，Chrome 加载 `dist/`；取消上一版的 `extension/` 层 | §1 技术选型、TD-10、§5 目录结构、§6 环境与部署 |
| v2   | 2026-08-19 13:33 | 目录结构改为插件自包含：扩展产物收进 `review-lens/extension/`、测试整体分离到 `review-lens/tests/`、devDependencies 装在插件内部。起因是 Chrome 拒绝加载含 `__tests__` 的扩展，且仓库根不应出现 `node_modules` | §5 目录结构、§6.1 开发环境 |
