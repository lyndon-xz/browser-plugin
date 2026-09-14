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

  let teardown = null;

  function unmount() {
    try {
      teardown?.();
    } catch {
      /* 扩展上下文已失效时 teardown 可能访问不到 chrome API */
    }
    teardown = null;
  }

  function mount() {
    void (async () => {
      try {
        const entry = await load("content/entry.js");
        const result = entry?.init();
        if (typeof result === "function") {
          teardown = result;
        }
      } catch (error) {
        report(error);
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
