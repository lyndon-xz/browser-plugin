(function () {
  "use strict";

  let isApplying = false;

  function applySortedURL(sortedURL) {
    if (sortedURL === window.location.href) return;

    // 消息在途期间页面可能已经跳到别的路径，此时这条重排结果已过期
    if (new URL(sortedURL).pathname !== window.location.pathname) return;

    isApplying = true;
    /*
     * 只换 URL，保留当前 history entry 的 state——依赖 history.state 定位的
     * SPA 路由（如 React Router 的 key/idx）被清空后前进后退会错乱
     */
    window.history.replaceState(window.history.state, "", sortedURL);
    isApplying = false;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === MESSAGE_ACTION.apply) {
      applySortedURL(message.url);
      sendResponse({ success: true });
    }
    return true;
  });

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  const URL_CHANGE_DEBOUNCE_MS = 100;

  let debounceTimer = null;
  let isOrphaned = false;

  /*
   * 扩展被重新加载/更新后，已注入页面的 content script 变为孤儿，sendMessage 会抛
   * "Extension context invalidated"。还原被改写的 history 方法并停止上报，
   * 避免在第三方宿主页反复产生未捕获异常
   */
  function releaseOrphanedScript() {
    isOrphaned = true;
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    clearTimeout(debounceTimer);
  }

  async function sendURLChange() {
    try {
      await chrome.runtime.sendMessage({
        action: MESSAGE_ACTION.urlChanged,
        url: window.location.href,
      });
    } catch (e) {
      releaseOrphanedScript();
      console.warn("content script orphaned, stop reporting:", e);
    }
  }

  function notifyURLChanged() {
    if (isOrphaned) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(
      () => void sendURLChange(),
      URL_CHANGE_DEBOUNCE_MS,
    );
  }

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    if (!isApplying) notifyURLChanged();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    if (!isApplying) notifyURLChanged();
  };

  window.addEventListener("popstate", () => {
    notifyURLChanged();
  });
})();
