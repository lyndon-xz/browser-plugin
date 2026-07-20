(function () {
  "use strict";

  let debounceTimer = null;
  let isApplying = false;

  function applyConfig(config) {
    if (
      !config ||
      !config.enabled ||
      !config.params ||
      config.params.length === 0
    ) {
      return;
    }

    const currentURL = window.location.href;
    // strict=false：仅重排现有参数，保留配置外的参数
    const newURL = buildSortedURL(currentURL, config.params, false);

    if (newURL !== currentURL) {
      isApplying = true;
      window.history.replaceState(null, "", newURL);
      isApplying = false;
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "apply") {
      applyConfig(message.config);
      sendResponse({ success: true });
    }
    return true;
  });

  function notifyURLChanged() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      // 扩展被重新加载/更新后，已注入页面的 content script 变为孤儿，
      // sendMessage 会抛 "Extension context invalidated"；此处静默降级，
      // 避免在第三方宿主页产生未捕获异常
      try {
        const sending = chrome.runtime.sendMessage({
          action: "urlChanged",
          url: window.location.href,
        });
        if (sending && typeof sending.catch === "function") {
          sending.catch(() => {});
        }
      } catch (e) {
        // context 已失效，忽略
      }
    }, 100);
  }

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

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
