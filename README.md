# @lyndon/browser-plugin

> 三个 **Manifest V3** Chrome 扩展，零依赖、无构建：目录即产物，`chrome://extensions/` 加载对应子目录即可。  
> **exam-helper** 在任意网页划词识题并内置 Java 规约 L2 模拟练习；**search-sort** 按站点重排 URL 查询参数；**review-lens** 在 GitLab MR 同屏对照评论与两个版本的代码。

![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?logo=googlechrome&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-ESM-F7DF1E?logo=javascript&logoColor=black) ![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-34A853?logo=googlechrome&logoColor=white) ![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen) ![No build](https://img.shields.io/badge/build-none-lightgrey) ![License](https://img.shields.io/badge/License-MIT-green)

| 插件        | 目录                            | 版本  | 做什么                                                                                         |
| ----------- | ------------------------------- | ----- | ---------------------------------------------------------------------------------------------- |
| exam-helper | [`exam-helper/`](./exam-helper) | 1.3.4 | 划词查题（题库匹配 + DeepSeek 兜底）；内置《Java 开发手册（黄山版）》L2 模拟考 / 快刷 / 错题本 |
| search-sort | [`search-sort/`](./search-sort) | 2.1.0 | 按根域名重排 URL 查询参数、注入缺失的默认值                                                    |
| review-lens | [`review-lens/`](./review-lens) | 2.1.0 | 在 GitLab MR 每条代码讨论旁开抽屉，同屏看评论、回复与两个版本的代码                            |

## 📦 安装

1. 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择要用的子目录（`exam-helper/`、`search-sort/` 或 `review-lens/`）
4. 改完源码在扩展页点「重新加载」；content script 的改动还需刷新宿主页

三个扩展互不依赖，可按需只装其中一个。

## exam-helper

### 📖 简介

在任意网页选中题目文字，先查内置预置题库（86 题，提炼自《Java 开发手册（黄山版）》），未命中且有选项时走 DeepSeek 推理。扩展页还内置 L2 模拟练习：可从手册 TXT 动态 AI 组卷，或直接用预置题库组卷。

### ✨ 特性

- **划词查答案**：选中题干后按 `⌃⇧A`、点右键菜单「exam-helper：查答案」，或依赖页面内快捷键；结果以气泡展示
- **双路答题**：📚 题库模糊匹配优先；未命中时 🤖 调用 DeepSeek（需配置密钥）
- **L2 模拟考**：50 题 · 90 分钟 · 80 分及格
- **15 题快刷**：27 分钟，适合碎片时间
- **错题本**：只练做错的题，支持断点续答
- **AI 组卷 / 题库组卷**：AI 模式从 `materials/*.txt` 抽取【强制】/【推荐】片段出题；不足时 fallback 到预置库
- **快捷键**：`⌥Q` 启用 / 禁用划词助手；`⌃⇧A` 查当前选区答案

### 🛠️ 使用

1. 点击工具栏图标，打开划词助手开关
2. 在网页上选中题目文字，按 `⌃⇧A` 或右键查答案
3. 弹窗里点「L2 练习」进入模拟考；点「验收页」打开内置 fixture 做功能验收
4. 练习页内同样支持 `⌃⇧A` 查答案，`←` `→` 切题，`Enter` 下一题

### ⚙️ 配置

DeepSeek API 密钥在 popup 里填写，仅存本机 `chrome.storage.local`。未配置时题库匹配不到将无法 AI 推理；AI 组卷同样依赖密钥。

请求经 background service worker 代理发往 `https://api.deepseek.com/chat/completions`，规避宿主页 CSP 限制。

## search-sort

### 📖 简介

以**根域名**为配置单位，在页面加载或前端路由变化时，按预设顺序重排 URL 查询参数，并为缺失的参数注入默认值。子域名共享同一套配置；IPv4 / IPv6 主机则以完整主机名隔离。

### ✨ 特性

- **参数排序**：按配置顺序重排查询串；参数集合不变时用 `replaceState` 原地软更新，不整页刷新
- **默认值注入**：为配置中缺失的参数写入默认值，此时通过整页导航带上新参数
- **拖拽排序**：弹窗里拖动 `≡` 手柄调整参数顺序
- **站点开关**：每个根域名可独立启用 / 停用，工具栏图标随状态切换
- **两种参数模式**：保存时以配置为准剔除配置外参数（`config-only`）；页面自动应用时保留配置外现有参数（`keep-extra`）
- **SPA 兼容**：改写 `pushState` / `replaceState` 并监听 `popstate`；扩展重载后孤儿 content script 会自动还原
- **防刷新循环**：同一 URL 在 5 秒窗口内最多导航 2 次即放弃

### 🛠️ 使用

1. 打开任意 `http(s)` 页面，点击扩展图标（非 `http(s)` 页面会提示不支持）
2. 弹窗顶部显示当前根域名，右侧开关控制该域名是否启用
3. 编辑参数默认值、拖动排序、删除或新增参数
4. 点「保存并应用」写入配置并立即重写当前标签页 URL

配置保存在 `chrome.storage.local` 的 `configs` 字段，以根域名为键。

## review-lens

### 📖 简介

读 GitLab MR 评审时，评论往往挂在旧版本上、和当前代码对不上。review-lens 在每条代码讨论旁挂「解读」入口，点开右侧抽屉，同屏给出：评论正文、同一主题下的回复、**评论写下时那个版本**的代码、**当前分支**上同一段代码。

内置 `git.dev.sh.ctripcorp.com` 与 `gitlab.com`；其他自建实例在设置页添加，浏览器会单独问授权。

### ✨ 特性

- **按方法名跨版本定位**：不沿用行号，按方法名重新定位；找不到就明说，不展示无关代码
- **三态结论**：代码改过（逐行对照）／至今未改动／已不在当前分支（列出相关 commit）
- **两种布局 + 同步滚动**：上下堆叠与左右并排随时切换
- **Java 语法着色**：关键字 / 类型 / 字符串 / 数字 / 注释五类，与 diff 底色独立
- **评论标识符可点**：正文里的类名与方法名渲染成 chip，点击滚到对应行
- **截图就地渲染**：只放行宿主 `/uploads/` 附件
- **学习卡片与导出**：读懂的一条存下来，弹窗里按仓库筛选、导出 Markdown
- **鉴权按站点隔离**：默认用 GitLab 登录态；401 时才需填只读 Token（`read_api`），按站点分开存

### 🛠️ 使用

1. 打开 GitLab MR 讨论页，每条代码讨论旁会出现「解读」入口
2. 点开抽屉查看评论、回复与两侧代码对照
3. 底部可存学习卡片；工具栏弹窗里搜索、筛选、导出 Markdown
4. 401 或自建实例：打开扩展设置页，按需填 Token 或添加 GitLab 站点

## 📂 目录结构

```
browser-plugin/
├── exam-helper/          # 划词识题 + L2 练习
│   ├── manifest.json
│   ├── background.js     # 快捷键、右键菜单、DeepSeek 代理、图标
│   ├── content/          # 划词助手 bootstrap 与 assist / selection 模块
│   ├── popup/            # 开关、密钥、入口按钮
│   ├── practice/         # L2 模拟考页面（core / ui / input）
│   ├── shared/           # 气泡 UI、matcher、DeepSeek、storage 等共用模块
│   ├── data/             # 预置题库 questions.js、exam-bank.js
│   ├── materials/        # 黄山版手册 PDF + TXT（AI 组卷读取）
│   └── fixtures/         # 验收页
├── search-sort/          # URL 参数排序
│   ├── manifest.json
│   ├── background.js
│   ├── content/          # bootstrap + entry：SPA 路由跟踪与 URL 改写
│   ├── popup/            # 参数列表、拖拽、保存
│   └── utils/            # domain、url、tab、storage、messages
└── review-lens/          # GitLab MR 代码对照
    ├── manifest.json
    ├── background.js
    ├── content/          # 入口挂载、评审数据、抽屉桥接
    ├── core/             # compare、gitlab 客户端、code 裁切与 diff、comment 解析
    ├── ui/               # 抽屉 Shadow DOM 与各段渲染
    └── popup/            # 卡片列表与设置页
```

## 👨‍💻 开发

- **零构建**：原生 JavaScript（ESM），改完在 `chrome://extensions/` 点「重新加载」即可
- **动态 import**：content script 通过 `import()` 加载子模块，新增文件时记得同步 `manifest.json` 的 `web_accessible_resources` glob，否则会报 `Failed to fetch dynamically imported module`
- **无 lint 配置**：需要检查时从外部借规范，扩展目录本身不额外加配置文件

## ❓ 常见问题

**exam-helper 划词没反应？**

确认 popup 里开关已打开。部分页面 CSP 或 iframe 可能限制注入；扩展自有页面（练习、验收）通过 `content/assist/` 显式初始化。

**search-sort 保存后页面不停刷新？**

站点若在服务端把注入的参数重定向掉，扩展会在 5 秒内最多导航 2 次后放弃，避免与站点互顶。

**review-lens 说「代码已不在当前分支」？**

方法被改名、挪走或删除了。抽屉会列出评论之后动过该文件的提交，点进去看作者怎么改的。

**review-lens 在自建 GitLab 上怎么用？**

打开扩展设置页，把实例地址（如 `https://gitlab.example.com`）加进站点列表，浏览器单独授权后即可注入。

## 📄 License

[MIT](./LICENSE) © Lyndon
