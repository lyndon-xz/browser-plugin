# @lyndon/browser-plugin

> 两个 **Manifest V3** Chrome 扩展：**Search Params Sorter** 按站点维度排序 URL 查询参数并注入默认值；**review-lens** 把 GitLab MR 的评论、回复、评论当时的代码与当前分支的代码放到同一屏上读。

![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?logo=googlechrome&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-ESM-F7DF1E?logo=javascript&logoColor=black) ![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-34A853?logo=googlechrome&logoColor=white) ![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen) ![No build](https://img.shields.io/badge/build-none-lightgrey) ![License](https://img.shields.io/badge/License-MIT-green)

| 插件                 | 目录                            | 版本  | 做什么                                                                |
| -------------------- | ------------------------------- | ----- | --------------------------------------------------------------------- |
| Search Params Sorter | [`search-sort/`](./search-sort) | 1.0.0 | 按根域名重排 URL 查询参数、注入缺失的默认值                           |
| review-lens          | [`review-lens/`](./review-lens) | 1.0.0 | 在 GitLab MR 的每条代码讨论旁开一个抽屉，同屏对照评论与两个版本的代码 |

两个插件都是零依赖、无构建：目录即产物，`chrome://extensions/` 直接加载对应目录即可。

## Search Params Sorter

### 📖 简介

Search Params Sorter 是一个 Chrome 浏览器扩展。它以**根域名**为配置单位，在页面加载或前端路由变化时，按你预设的顺序重排该站点的 URL 查询参数，并为缺失的参数注入默认值。适合需要固定参数顺序、统一默认查询条件的站点使用。

配置针对根域名生效（如 `example.com`），子域名共享同一套配置；对 IP 主机（IPv4 / IPv6）则以完整主机名作为独立配置键，避免不同 IP 之间相互串用配置。

### ✨ 特性

- 🔀 **参数排序**：按配置中的参数顺序重排 URL 查询串。参数集合不变时由 content script 以 `replaceState` 原地软更新，不整页刷新，也不动宿主页的 `history.state`。
- 🧩 **默认值注入**：为配置中缺失的参数写入默认值，此时通过整页导航带上新参数。
- 🌐 **按根域名配置**：自动提取根域名（内置 30 余个二级 TLD，如 `com.cn`、`co.uk`、`edu.cn`），子域名共用；IP 主机按完整主机名隔离。
- 🖱️ **拖拽排序**：在弹窗中拖动 `≡` 手柄即可调整参数顺序。
- 🎚️ **站点开关**：每个域名可独立启用 / 停用，工具栏图标随激活状态在 active / inactive 间切换。
- 🎛️ **两种参数模式**：保存时以配置为准剔除配置外的参数（`config-only`）；页面自动应用时保留配置外的现有参数、只做排序与默认值注入（`keep-extra`）。
- ⚡ **SPA 兼容**：改写 `pushState` / `replaceState` 并监听 `popstate`，跟踪前端路由变化；扩展被重新加载后，孤儿 content script 会自动还原这两个方法并停止上报。
- 🛡️ **防刷新循环**：站点若在服务端把注入的参数重定向掉，同一 URL 在 5 秒窗口内最多导航 2 次即放弃，不与站点互顶。

### 📦 安装

以开发者模式加载未打包扩展：

1. 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本仓库的 `search-sort/` 目录

### 🛠️ 使用

1. 打开任意 `http(s)` 页面，点击工具栏中的扩展图标（非 `http(s)` 页面会提示「不支持此页面」并禁用操作）。
2. 弹窗顶部显示当前根域名，右侧开关控制该域名是否启用。
3. 参数列表会合并「已保存配置」与「当前 URL 中的参数」，配置外新冒出来的参数标有「新」徽标：
   - 点击参数值可编辑默认值（留空表示不设默认值，仅参与排序）。
   - 拖动 `≡` 手柄调整参数顺序。
   - 点击 `×` 删除参数，或用「+ 新增参数」手动添加。
4. 点击「保存并应用」写入配置。启用状态下会立即按 `config-only` 模式重写当前标签页 URL。

### 📂 目录结构

```
search-sort/
├── manifest.json        # MV3 清单：权限、service worker、content script、图标
├── background.js        # service worker：监听标签更新与消息，应用配置并切换图标
├── content.js           # content script：改写 history API 跟踪 SPA 路由，执行原地软更新
├── popup/
│   ├── popup.html       # 弹窗结构
│   ├── popup.css        # 弹窗样式：flex 布局，参数列表为唯一滚动区
│   ├── popup.js         # 弹窗主流程：初始化、列表渲染、新增、保存
│   ├── drag.js          # createDragSort：拖拽排序交互与索引计算
│   └── edit-value.js    # startEditValue：默认值的行内编辑
├── utils/
│   ├── message.js       # MESSAGE_ACTION：background / content / popup 三方共享的消息协议
│   ├── domain.js        # extractRootDomain：根域名提取，含二级 TLD 与 IP 主机处理
│   ├── url.js           # PARAM_MODE / applyParamRules / buildURLWithParamRules：参数规则与 URL 构建
│   ├── tab.js           # applyURLToTab：判定软更新或整页导航，含降级与防循环
│   └── storage.js       # StorageHelper：基于 chrome.storage.local 的配置读写
└── icons/
    ├── active/          # 启用状态图标（16/32/48/128）
    └── inactive/        # 停用状态图标（16/32/48/128）
```

### ⚙️ 配置存储

配置保存在 `chrome.storage.local` 的 `configs` 字段下，以根域名为键：

```jsonc
{
  "configs": {
    "example.com": {
      "enabled": true,
      "params": [
        { "key": "sort", "defaultValue": "hot" },
        { "key": "page", "defaultValue": null },
      ],
    },
  },
}
```

- `enabled`：该域名是否启用重写。
- `params`：有序参数列表，顺序即最终 URL 中的参数顺序；`defaultValue` 为 `null` 时不注入默认值，仅参与排序。

### ❓ 常见问题

**删掉一个参数后，它以后还会出现吗？**

会。删除只对点「保存并应用」那一次的 URL 生效（`config-only` 模式会把它从 URL 里剔掉），不是一条持久规则：之后再访问带该参数的链接时，自动应用走的是 `keep-extra` 模式，会保留它并排在配置参数之后，再打开弹窗它也会以「新」徽标回到列表里。

**什么时候整页刷新、什么时候不刷新？**

参数集合没变、只是顺序变了，就让 content script 用 `replaceState` 原地软更新，页面不刷新；一旦注入了默认值或增删了参数，只能整页导航才能让站点读到新参数。content script 尚未就绪时（首屏未注入完、扩展刚更新），软更新会降级为整页导航。

## review-lens

### 📖 简介

读 GitLab 的 MR 评审时有三件事很费劲：评论挂在旧版本上、和当前代码对不上；想看「后来改成什么样」得自己在两个版本间来回跳；作者的回复里往往写着答案，却和评论正文分开显示。

review-lens 在每条代码讨论旁挂一个「解读」入口，点开右侧抽屉，同屏给出四样东西：评论正文、同一主题下的回复、**评论写下时那个版本**的代码、**当前分支**上同一段代码。

### ✨ 特性

- 🔍 **按方法名跨版本定位**：不沿用行号（文件改过后行号会漂移），也不用被评论那一行的文本去搜（那行往往正是被改掉的），而是按方法名重新定位；找不到就明说找不到，绝不展示一段无关代码。
- 🧭 **三种结论各说各话**：这段代码改过（两侧逐行对照、只标真正变了的行）／至今未改动（给结论与依据：评论之后有几个提交动过这个文件）／已不在当前分支（列出评论之后动过该文件的提交，可点开到 commit 页）。
- 📐 **两种布局 + 同步滚动**：上下堆叠与左右并排随时切换，同步滚动让两侧始终停在对应的那段代码上；切换不会把你已经定位好的位置丢掉。
- 🎨 **Java 语法着色**：关键字／类型／字符串／数字／注释五类，与 diff 底色是两层独立通道，互不干扰。
- 🔗 **评论里的标识符可点**：正文提到且代码里真出现了的类名与方法名渲染成 chip，点一下滚到对应行并闪一下；代码里没出现的不做成链接。
- 🖼️ **评论里的截图就地渲染**：评审里「改成这种」常常就是一张贴图，正文只留一行 Markdown。只放行宿主自己的 `/uploads/` 附件，外站图片保留原文本不加载。
- 📇 **学习卡片与导出**：把读懂的一条存下来（带回到原评论的链接），弹窗里按仓库筛选、一键导出 Markdown。
- 🔐 **鉴权按站点隔离**：默认用你在 GitLab 的登录态；实例关了会话取数时才需要填只读 Token（`read_api`），令牌按站点分开存、只发给它所属的那个站点。

### 📦 安装

1. 打开 `chrome://extensions/`，开启「开发者模式」
2. 「加载已解压的扩展程序」，选择本仓库的 `review-lens/` 目录
3. 打开任意 GitLab MR 页面（清单里内置一个内网 GitLab 与 `gitlab.com`；其他自建实例在扩展的设置页里添加，浏览器会单独问你授权）

改完源码只需在扩展页点一次「重新加载」，content script 的改动还需刷新宿主页。

### 📂 目录结构

按「这段代码回答什么问题」分层，四个领域之间没有横向依赖，只有 `core/compare.js` 作为编排者从上往下引：

```
review-lens/                    # ← Chrome 直接加载这里
├── manifest.json
├── background.js               # service worker：存储读写、设置页、动态注册站点、工具栏图标
├── content/
│   ├── bootstrap.js            # 非 module：判定页面，命中才动态 import 下面这些
│   ├── entry.js                # 编排：把入口、评审数据、抽屉接起来
│   ├── entries.js              # 「解读」入口的挂载与卸载，只认 DOM
│   ├── threads.js              # 这条 MR 的评审数据与两个对照基准
│   ├── drawer-bridge.js        # 抽屉懒建、界面偏好接存储、给卡片补回原处的链接
│   └── run-detached.js         # 同步回调里发起异步、失败只记日志
├── core/
│   ├── compare.js              # 三态判别：changed / unchanged / unlocatable
│   ├── export.js               # 卡片 → Markdown
│   ├── gitlab/                 # 与 GitLab 实例打交道：客户端、页面解析、讨论、取文件
│   ├── code/                   # 纯函数：裁片段、找方法边界、行级 LCS、Java token
│   ├── comment/                # 评论正文解析：标识符、相关行、截图附件
│   └── platform/               # chrome.* 之上的适配层：消息协议、存储、动态注册站点
├── ui/
│   ├── drawer.js               # 编排层：持有全部可变状态，组装下面各段
│   ├── drawer.css              # 视觉 token 与各段样式
│   └── drawer/                 # 各段渲染，全是纯函数：接数据与回调、返回 DOM
│       ├── shell.js            # 宿主节点与 Shadow DOM、关闭、宽度拖拽、锁宿主页滚动
│       ├── verdict.js          # 顶栏、徽标、在看哪一段、右侧无代码时的结论
│       ├── comment-card.js     # 评论与回复，正文里的标识符 chip
│       ├── panes.js            # 两栏、视图切换、同步滚动、滚动定位
│       ├── code-pane.js        # 代码栏：行渲染、三个标记通道
│       ├── foot.js             # 扩大范围、相关行、笔记、存卡片
│       ├── failure.js          # 失败态：机器原因 + 人话结论 + 出路
│       └── date.js             # 展示用日期格式化
├── popup/                      # 卡片列表与设置页
└── icons/                      # active/ 与 inactive/ 各四档
```

### 🧱 技术栈

原生 JavaScript（ESM）+ Manifest V3，零运行时依赖、零 devDependency、无构建步骤。权限只要 `storage` 与 `scripting`，额外站点走 `optional_host_permissions` 按次授权。

抽屉跑在 Shadow DOM 里，不污染宿主页样式；代码与评论正文一律 `textContent` 写入，绝不拼 HTML。GitLab 只发 GET，请求按 `sha + path` 在内存里缓存，不落盘。

### 👨‍💻 开发

改完点一次「重新加载」即可，没有构建步骤。目录结构变动后有两处容易漏：

- `manifest.json` 的 `web_accessible_resources`：content script 用动态 `import` 加载模块，模块图里任何一个文件没被 glob 覆盖，整条 `import` 就会失败，症状是 `Failed to fetch dynamically imported module`。加子目录时记得同步 glob。
- 同一份值不要落在两处：站点列表从 `chrome.runtime.getManifest()` 推导，动画时长只留在 CSS 里，默认宽度只由存储层给。

仓库刻意不带 lint 配置。要跑检查时借外部规范仓库的配置从仓库外 lint，扩展目录不会多出文件。

### ❓ 常见问题

**为什么点开某条评论说「代码已不在当前分支」？**

方法被改名、挪走或删除了。这时不猜它变成了什么，而是列出评论之后动过这个文件的提交，你点进去看作者到底怎么改的。

**徽标说「至今未改动」，可是 MR 明明有新提交？**

「有新提交」和「评论指的这段代码变了」是两件事。徽标只看这段代码本身有没有差异，与代码区的着色同一个判据，不会出现「说明行没写有改动、徽标却说改动了」这种自相矛盾。

**在自建的 GitLab 实例上要怎么用？**

打开扩展的设置页，把实例地址（形如 `https://gitlab.example.com`）加进站点列表。浏览器会单独问你授权，同意后扩展才会在那个域名上注入。令牌按站点分别填写，不会串到别的实例上。

## 📄 License

[MIT](./LICENSE) © Lyndon
