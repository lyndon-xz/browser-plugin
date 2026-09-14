import { MESSAGE_ACTION } from "../utils/messages.js";
import { hasSameSearchParams } from "../utils/url.js";

let isApplying = false;

function isCurrentSource(sourceURL) {
  if (window.location.href === sourceURL) {
    return true;
  }

  try {
    return hasSameSearchParams(window.location.href, sourceURL);
  } catch {
    return false;
  }
}

function applySortedURL(sortedURL, sourceURL) {
  if (sortedURL === window.location.href) {
    return true;
  }

  // 消息在途期间页面可能已经改了查询串或跳走，此时这条重排结果已过期
  if (!isCurrentSource(sourceURL)) {
    return false;
  }

  isApplying = true;
  /*
   * 只换 URL，保留当前 history entry 的 state——依赖 history.state 定位的
   * SPA 路由（如 React Router 的 key/idx）被清空后前进后退会错乱
   */
  window.history.replaceState(window.history.state, "", sortedURL);
  isApplying = false;
  return true;
}

/** 监听 SPA 路由变化并接收 background 下发的原地 URL 替换 */
export function init() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

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

  const isOrphanedError = (error) =>
    /Extension context invalidated|message port closed/i.test(
      error?.message ?? "",
    );

  async function sendURLChange() {
    try {
      await chrome.runtime.sendMessage({
        action: MESSAGE_ACTION.urlChanged,
        url: window.location.href,
      });
    } catch (e) {
      if (isOrphanedError(e)) {
        releaseOrphanedScript();
        console.warn("[search-sort] content script 已失效，停止上报：", e);
      } else {
        console.warn("[search-sort] urlChanged 消息失败：", e);
      }
    }
  }

  const URL_CHANGE_DEBOUNCE_MS = 100;

  function notifyURLChanged() {
    if (isOrphaned) {
      return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(
      () => void sendURLChange(),
      URL_CHANGE_DEBOUNCE_MS,
    );
  }

  function onPopState() {
    notifyURLChanged();
  }

  function onMessage(message, _sender, sendResponse) {
    const { action, url, sourceURL } = message;

    if (action === MESSAGE_ACTION.apply) {
      const applied = applySortedURL(url, sourceURL);
      sendResponse({ applied });
    }
    return true;
  }

  function addRuntimeListener() {
    try {
      chrome?.runtime?.onMessage?.addListener(onMessage);
      return Boolean(chrome?.runtime?.onMessage);
    } catch {
      return false;
    }
  }

  function removeRuntimeListener() {
    try {
      chrome?.runtime?.onMessage?.removeListener(onMessage);
    } catch {
      /* 扩展上下文已失效 */
    }
  }

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    if (!isApplying) {
      notifyURLChanged();
    }
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    if (!isApplying) {
      notifyURLChanged();
    }
  };

  if (!addRuntimeListener()) {
    releaseOrphanedScript();
    return () => {
      window.removeEventListener("popstate", onPopState);
      releaseOrphanedScript();
    };
  }

  window.addEventListener("popstate", onPopState);

  return () => {
    removeRuntimeListener();
    window.removeEventListener("popstate", onPopState);
    releaseOrphanedScript();
  };
}
