import { MESSAGE_ACTION } from "../utils/messages.js";
import { isOrphanedError } from "../utils/runtime-error.js";
import { hasSameSearchParams } from "../utils/url.js";

const URL_CHANGE_DEBOUNCE_MS = 100;

/*
 * 改写 history 方法并监听 popstate，把页面内的 URL 变化上报给 background。
 * runSilently 供「我们自己改 URL」时借用：那次变化不该再上报回去
 */
function createURLReporter() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  let debounceTimer = null;
  let isSilent = false;
  let isOrphaned = false;

  /*
   * 扩展被重新加载/更新后，已注入页面的 content script 变为孤儿，sendMessage 会抛
   * "Extension context invalidated"。还原被改写的 history 方法并停止上报，
   * 避免在第三方宿主页反复产生未捕获异常
   */
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

/** 接收 background 下发的重排结果，原地替换当前 URL */
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
      /*
       * 只换 URL，保留当前 history entry 的 state——依赖 history.state 定位的
       * SPA 路由（如 React Router 的 key/idx）被清空后前进后退会错乱
       */
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
   * 就绪后立刻上报当前 URL。重排要靠本脚本原地替换，而本脚本是 document_end 之后
   * 动态 import 起来的，background 监听页面加载完成的那一刻往往还没注册上监听，
   * 消息投递不到。由就绪方主动开口，才不依赖两边的时序
   */
  void reporter.reportNow();

  return () => {
    receiver.teardown();
    reporter.teardown();
  };
}
