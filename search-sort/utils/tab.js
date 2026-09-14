import { MESSAGE_ACTION } from "./messages.js";
import { hasSameSearchParams } from "./url.js";

/*
 * 标签页操作相关工具。依赖 chrome.tabs，仅供 background / popup 使用，
 * 不应注入到内容脚本（content script）环境。
 */

const isTabGoneError = (error) =>
  /No tab with id/i.test(error?.message ?? String(error));

/** tab 关闭时清掉导航计数，避免 Map 泄漏 */
export function forgetTab(tabId) {
  navigationAttempts.delete(tabId);
}

/*
 * 站点若在服务端把注入的默认值重定向掉，会与本扩展形成
 * 「注入 → 刷新 → 站点剔除 → 再注入」的循环，同一 URL 超过上限即放弃导航。
 * service worker 被回收后计数归零，属兜底防护而非强保证
 */
const MAX_NAVIGATION_PER_URL = 2;
const NAVIGATION_WINDOW_MS = 5000;

// tabId -> { url, count, firstAt }
const navigationAttempts = new Map();

function shouldSkipNavigation(tabId, newURL) {
  const now = Date.now();

  for (const [recordedTabId, recordedAttempt] of navigationAttempts) {
    if (now - recordedAttempt.firstAt > NAVIGATION_WINDOW_MS) {
      navigationAttempts.delete(recordedTabId);
    }
  }

  const attempt = navigationAttempts.get(tabId);
  if (!attempt) {
    navigationAttempts.set(tabId, { url: newURL, count: 1, firstAt: now });
    return false;
  }

  const { url, count } = attempt;
  if (url !== newURL) {
    navigationAttempts.set(tabId, { url: newURL, count: 1, firstAt: now });
    return false;
  }

  attempt.count = count + 1;
  return attempt.count > MAX_NAVIGATION_PER_URL;
}

function isStillSourceURL(currentURL, sourceURL) {
  return currentURL === sourceURL || hasSameSearchParams(currentURL, sourceURL);
}

/**
 * 把重排后的 URL 应用到指定标签页。分支看查询参数多重集是否相同（hasSameSearchParams）：
 * - 字符串完全相同：不处理
 * - 多重集相同：content script replaceState；sendMessage 失败时降级 tabs.update
 * - 多重集不同：tabs.update 整页导航
 */
export async function applyURLToTab(urlUpdate) {
  const { tabId, oldURL, newURL } = urlUpdate;
  if (newURL === oldURL) {
    return;
  }

  if (hasSameSearchParams(oldURL, newURL)) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: MESSAGE_ACTION.apply,
        url: newURL,
        sourceURL: oldURL,
      });
      return;
    } catch (e) {
      if (isTabGoneError(e)) {
        return;
      }
      /*
       * content script 尚未就绪（首屏未注入完、或扩展刚更新），软更新走不通，
       * 降级为整页导航，保证重排至少能生效
       */
      console.warn("[search-sort] sendMessage 失败，降级整页导航：", e);
    }
  }

  if (shouldSkipNavigation(tabId, newURL)) {
    console.warn("[search-sort] 跳过导航以避免刷新循环：", newURL);
    return;
  }

  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (e) {
    if (isTabGoneError(e)) {
      return;
    }
    throw e;
  }
  if (!tab.url || !isStillSourceURL(tab.url, oldURL)) {
    return;
  }

  try {
    await chrome.tabs.update(tabId, { url: newURL });
  } catch (e) {
    if (!isTabGoneError(e)) {
      throw e;
    }
  }
}
