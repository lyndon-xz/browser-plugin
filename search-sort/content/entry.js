import { MESSAGE_ACTION } from "../utils/messages.js";
import { isOrphanedError } from "../utils/runtime-error.js";
import { hasSameSearchParams } from "../utils/url.js";

const URL_CHANGE_DEBOUNCE_MS = 100;

function createURLReporter() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  let debounceTimer = null;
  let isSilent = false;
  let isOrphaned = false;

  // 扩展重载后本脚本变孤儿，还原改写过的 history 方法，免得在宿主页反复抛异常
  function release() {
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
      if (isOrphanedError(e)) {
        release();
        console.warn("[search-sort] content script 已失效，停止上报：", e);
      } else {
        console.warn("[search-sort] urlChanged 消息失败：", e);
      }
    }
  }

  function scheduleReport() {
    if (isOrphaned || isSilent) {
      return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(
      () => void sendURLChange(),
      URL_CHANGE_DEBOUNCE_MS,
    );
  }

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    scheduleReport();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    scheduleReport();
  };

  window.addEventListener("popstate", scheduleReport);

  return {
    reportNow: sendURLChange,

    // 在 action 期间挂起上报：我们自己改的 URL 不该再报回 background
    runSilently(action) {
      isSilent = true;
      try {
        action();
      } finally {
        isSilent = false;
      }
    },

    teardown() {
      window.removeEventListener("popstate", scheduleReport);
      release();
    },
  };
}

// 接收 background 下发的重排结果，原地替换当前 URL
function createApplyReceiver(deps) {
  const { runSilently } = deps;

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

    runSilently(() => {
      // 保留原 state：清空后，靠 history.state 定位的 SPA 路由前进后退会错乱
      window.history.replaceState(window.history.state, "", sortedURL);
    });
    return true;
  }

  function onMessage(message, _sender, sendResponse) {
    const { action, url, sourceURL } = message;

    if (action === MESSAGE_ACTION.apply) {
      sendResponse({ isApplied: applySortedURL(url, sourceURL) });
    }
    return true;
  }

  let isRegistered = false;
  try {
    chrome?.runtime?.onMessage?.addListener(onMessage);
    isRegistered = Boolean(chrome?.runtime?.onMessage);
  } catch {
    isRegistered = false;
  }

  return {
    isRegistered,

    teardown() {
      try {
        chrome?.runtime?.onMessage?.removeListener(onMessage);
      } catch (e) {
        if (!isOrphanedError(e)) {
          console.error("[search-sort] 注销消息监听失败：", e);
        }
      }
    },
  };
}

/** 装配 URL 上报与重排接收两半，返回 teardown */
export function init() {
  const reporter = createURLReporter();
  const receiver = createApplyReceiver({ runSilently: reporter.runSilently });

  if (!receiver.isRegistered) {
    reporter.teardown();
    return () => {};
  }

  /*
   * 重排要靠本脚本原地替换，而它是 document_end 之后才动态 import 起来的，background
   * 在页面加载完成那一刻往往还没注册上监听，消息投递不到，改由就绪方主动开口
   */
  void reporter.reportNow();

  return () => {
    receiver.teardown();
    reporter.teardown();
  };
}
