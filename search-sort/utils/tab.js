import { MESSAGE_ACTION } from "./messages.js";
import { hasSameSearchParams } from "./url.js";

/*
 * 标签页操作相关工具。依赖 chrome.tabs，仅供 background / popup 使用，
 * 不应注入到内容脚本（content script）环境。
 */

const isTabGoneError = (error) =>
  /No tab with id/i.test(error?.message ?? String(error));

function isStillSourceURL(currentURL, sourceURL) {
  return currentURL === sourceURL || hasSameSearchParams(currentURL, sourceURL);
}

/**
 * 交给 content script 原地 replaceState，页面不重新加载。
 * 只适用于参数多重集不变的重排；走不通就什么都不做，不会退化成整页导航
 */
export async function replaceURLInTab(urlUpdate) {
  const { tabId, oldURL, newURL } = urlUpdate;
  if (newURL === oldURL) {
    return { applied: true, reason: "unchanged" };
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: MESSAGE_ACTION.apply,
      url: newURL,
      sourceURL: oldURL,
    });
    return {
      applied: Boolean(response?.applied),
      reason: response?.applied ? "soft-update" : "soft-update-skipped",
    };
  } catch (e) {
    if (isTabGoneError(e)) {
      return { applied: false, reason: "tab-gone" };
    }
    /*
     * content script 尚未就绪（首屏未注入完、或扩展刚更新）。重排只是整理地址栏，
     * 不值得为它刷新页面，跳过这次即可——下次 URL 变化会再来一遍
     */
    console.warn("[search-sort] sendMessage 失败，跳过本次重排：", e);
    return { applied: false, reason: "content-script-unavailable" };
  }
}

/**
 * 把按配置改写的 URL 应用到指定标签页，供用户主动保存时调用：
 * - 参数多重集不变：原地 replaceState
 * - 参数有增删：只能整页导航，站点才读得到新参数
 */
export async function applyURLToTab(urlUpdate) {
  const { tabId, oldURL, newURL } = urlUpdate;
  if (newURL === oldURL) {
    return { applied: true, reason: "unchanged" };
  }

  if (hasSameSearchParams(oldURL, newURL)) {
    const softResult = await replaceURLInTab(urlUpdate);
    if (softResult.applied) {
      return softResult;
    }
  }

  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (e) {
    if (isTabGoneError(e)) {
      return { applied: false, reason: "tab-gone" };
    }
    throw e;
  }
  if (!tab.url || !isStillSourceURL(tab.url, oldURL)) {
    return { applied: false, reason: "source-mismatch" };
  }

  try {
    await chrome.tabs.update(tabId, { url: newURL });
    return { applied: true, reason: "hard-navigation" };
  } catch (e) {
    if (isTabGoneError(e)) {
      return { applied: false, reason: "tab-gone" };
    }
    throw e;
  }
}
