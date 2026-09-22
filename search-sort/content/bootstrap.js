/*
 * content_scripts 里唯一的非 module 文件：MV3 不支持把 content script 声明成 module，
 * 主逻辑放在 ESM 模块里，这里只做引导与生命周期。
 */
(function () {
  "use strict";

  const load = (path) => import(chrome.runtime.getURL(path));

  let teardown = null;

  function unmount() {
    // teardown 自己已经收口了失效上下文的报错，这里不再兜一层
    teardown?.();
    teardown = null;
  }

  function mount() {
    void (async () => {
      let isOrphanedError;
      try {
        ({ isOrphanedError } = await load("utils/runtime-error.js"));
      } catch {
        // 连判定模块都取不到，只可能是扩展上下文已失效，静默退出
        return;
      }

      try {
        const entry = await load("content/entry.js");
        const result = entry?.init();
        if (typeof result === "function") {
          teardown = result;
        }
      } catch (error) {
        if (!isOrphanedError(error)) {
          console.error("[search-sort] 启动失败：", error);
        }
      }
    })();
  }

  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) {
      unmount();
    }
  });

  window.addEventListener("pageshow", (event) => {
    // bfcache 恢复时脚本通常仍在；仅 teardown 已释放时才重挂
    if (event.persisted && !teardown) {
      mount();
    }
  });

  mount();
})();
