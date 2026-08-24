/*
 * content_scripts 里唯一的非 module 文件：MV3 不支持把 content script 声明成 module，
 * 只支持动态 import，因此判定与主逻辑都放在可单测的 ESM 模块里，这里只做引导。
 */
(function () {
  "use strict";

  const load = (path) => import(chrome.runtime.getURL(path));

  load("core/page.js")
    .then(({ isMergeRequestPage }) => {
      if (!isMergeRequestPage(document, window.location)) return null;
      return load("content/entry.js");
    })
    .then((entry) => entry?.init())
    .catch((error) => {
      /*
       * 扩展刚更新时旧的 content script 会成孤儿，import 必然失败，这类无需打扰。
       * 其余错误必须留出口：静默 catch 会让任何失败都表现为「页面毫无反应」，无从排查。
       */
      const orphaned = /Extension context invalidated|message port closed/i.test(error?.message ?? "");
      if (!orphaned) console.error("[review-lens] 启动失败：", error);
    });
})();
