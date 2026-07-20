# @lyndon/browser-plugin

> 一个 **Manifest V3** Chrome 扩展 **Search Params Sorter**：按站点维度**排序 URL 查询参数**并**注入默认值**，让同一网站的链接参数顺序稳定、可复用。

![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?logo=googlechrome&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black) ![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-34A853?logo=googlechrome&logoColor=white) ![version](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/License-MIT-green)

## 📖 简介

Search Params Sorter 是一个 Chrome 浏览器扩展。它以**根域名**为配置单位，在页面加载或前端路由变化时，按你预设的顺序重排该站点的 URL 查询参数，并为缺失的参数注入默认值。适合需要固定参数顺序、统一默认查询条件的站点使用。

配置针对根域名生效（如 `example.com`），子域名共享同一套配置；对 IP 主机（IPv4 / IPv6）则以完整主机名作为独立配置键，避免不同 IP 之间相互串用配置。

## ✨ 特性

- 🔀 **参数排序**：按配置中的参数顺序重排 URL 查询串，参数集合不变时以 `replaceState` 原地软更新，避免整页刷新。
- 🧩 **默认值注入**：为配置中缺失的参数写入默认值，触发整页刷新以带上新参数。
- 🌐 **按根域名配置**：自动提取根域名（支持 `com.cn`、`co.uk` 等二级 TLD），子域名共用；IP 主机按完整主机名隔离。
- 🖱️ **拖拽排序**：在弹窗中拖动参数项即可调整顺序。
- 🎚️ **站点开关**：每个域名可独立启用/停用，图标随激活状态在 active / inactive 间切换。
- 🔒 **strict 模式**：保存时以配置为准剔除多余参数；页面自动应用时保留配置外的现有参数，只做排序与默认值注入。
- ⚡ **SPA 兼容**：劫持 `pushState` / `replaceState` 并监听 `popstate`，跟踪前端路由变化。

## 📦 安装

以开发者模式加载未打包扩展：

1. 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本仓库的 `search-sort/` 目录

## 🛠️ 使用

1. 打开任意 `http(s)` 页面，点击工具栏中的扩展图标。
2. 弹窗顶部显示当前根域名，右侧开关控制该域名是否启用。
3. 参数列表会合并「已保存配置」与「当前 URL 中的参数」，新增的参数标有「新」徽标：
   - 点击参数值可编辑默认值（留空表示不设默认值）。
   - 拖动 `≡` 手柄调整参数顺序。
   - 点击 `×` 删除参数，或用「+ 新增参数」手动添加。
4. 点击「保存并应用」写入配置。启用状态下会立即以 strict 模式重写当前标签页 URL。

## 📂 目录结构

```
search-sort/
├── manifest.json        # MV3 清单：权限、service worker、content script、图标
├── background.js        # service worker：监听标签更新/消息，按配置应用并切换图标
├── content.js           # content script：劫持 history API，跟踪 SPA 路由变化
├── popup/
│   ├── popup.html       # 弹窗结构
│   ├── popup.css        # 弹窗样式
│   └── popup.js         # 弹窗逻辑：参数编辑、拖拽排序、保存
├── utils/
│   ├── domain.js        # extractRootDomain：根域名提取，含二级 TLD 与 IP 处理
│   ├── url.js           # sortParams / buildSortedURL：参数排序与 URL 构建
│   ├── tab.js           # applyURLToTab：判定软更新或整页刷新并应用
│   └── storage.js       # StorageHelper：基于 chrome.storage.local 的配置读写
└── icons/
    ├── active/          # 启用状态图标（16/32/48/128）
    └── inactive/        # 停用状态图标（16/32/48/128）
```

## 🧱 技术栈

- Chrome Extension **Manifest V3**（`background.service_worker` + `content_scripts`）
- 原生 JavaScript，无构建步骤、无第三方依赖
- Chrome API：`chrome.tabs`、`chrome.storage.local`、`chrome.runtime`、`chrome.action`
- 权限：`activeTab`、`storage`，`host_permissions` 为 `<all_urls>`

## ⚙️ 配置存储

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

## 📄 License

[MIT](./LICENSE) © Lyndon
