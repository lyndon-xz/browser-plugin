/*
 * content_scripts 里唯一的非 module 文件：MV3 不支持把 content script 声明成 module，
 * 只支持动态 import，因此判定与主逻辑放在 ESM 模块里，这里只做引导与生命周期。
 * GitLab 的 MR 页是客户端路由，切换视图不触发文档级导航，挂载与卸载都要跟着路由走。
 */
(function () {
  "use strict";

  const load = (path) => import(chrome.runtime.getURL(path));

  // 扩展更新后旧的 content script 会成孤儿，import 会失败，这类无需打扰
  const isOrphaned = (error) =>
    /Extension context invalidated|message port closed/i.test(
      error?.message ?? "",
    );

  const report = (error) => {
    // 其余错误要留出口：静默 catch 会让失败表现为「页面毫无反应」，无从排查
    if (!isOrphaned(error)) console.error("[review-lens] 启动失败：", error);
  };

  let teardown = null;
  // 同一次路由变化可能连着触发多个事件，用它把并发的挂载收敛成一次
  let mounting = null;

  function unmount() {
    teardown?.();
    teardown = null;
  }

  async function sync() {
    try {
      const pageModule = await load("core/gitlab/page.js");
      const onMergeRequestPage = pageModule.isMergeRequestPage(
        document,
        window.location,
      );

      if (!onMergeRequestPage) {
        unmount();
        return;
      }
      // 已经挂着就不重复挂：SPA 内部的局部更新也会走到这里
      if (teardown) return;

      const entry = await load("content/entry.js");
      const result = await entry?.init();
      if (typeof result === "function") teardown = result;
    } catch (error) {
      report(error);
    }
  }

  // 串成一条链，挂载不并发跑；sync 自己处置失败，上一次不会让这条链断掉
  const syncOnce = () => {
    const previous = mounting;
    mounting = (async () => {
      await previous;
      await sync();
    })();
  };

  // pushState / replaceState 不派发事件，只能包一层；保留返回值与 this 让宿主页路由照旧工作
  for (const name of ["pushState", "replaceState"]) {
    const original = history[name];
    history[name] = function patched(...args) {
      const returned = original.apply(this, args);
      syncOnce();
      return returned;
    };
  }

  window.addEventListener("popstate", syncOnce);
  // 页面被丢弃或转入缓存时也要收干净，监听不留在即将不可见的文档上
  window.addEventListener("pagehide", unmount);

  syncOnce();
})();
