/*
 * content_scripts 里唯一的非 module 文件：MV3 不支持把 content script 声明成 module，
 * 主逻辑放在 ESM 模块里，这里只做引导与生命周期。
 */
(function () {
  "use strict";

  const load = (path) => import(chrome.runtime.getURL(path));

  const isOrphaned = (error) =>
    /Extension context invalidated|message port closed/i.test(
      error?.message ?? "",
    );

  const report = (error) => {
    if (!isOrphaned(error)) {
      console.error("[search-sort] 启动失败：", error);
    }
  };

  void (async () => {
    try {
      const entry = await load("content/entry.js");
      entry?.init();
    } catch (error) {
      report(error);
    }
  })();
})();
