import { MESSAGE_ACTION } from "./messages.js";
import { isTabGoneError } from "./runtime-error.js";
import { hasSameSearchParams } from "./url.js";

/*
 * 标签页操作相关工具。依赖 chrome.tabs，仅供 background / popup 使用，
 * 不应注入到内容脚本（content script）环境。
 */

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
    return { isApplied: true };
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: MESSAGE_ACTION.apply,
      url: newURL,
      sourceURL: oldURL,
    });
    return { isApplied: Boolean(response?.isApplied) };
  } catch (e) {
    if (isTabGoneError(e)) {
      return { isApplied: false };
    }
    /*
     * content script 还没就绪或跑不起来（首屏未注入完、扩展刚更新、页面禁止注入）。
     * 属预期情形，不告警：就绪后它会主动上报 URL，重排在那时补上
     */
    return { isApplied: false };
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
    return { isApplied: true };
  }

  if (hasSameSearchParams(oldURL, newURL)) {
    const { isApplied } = await replaceURLInTab(urlUpdate);
    if (isApplied) {
      return { isApplied };
    }
  }

  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (e) {
    if (isTabGoneError(e)) {
      return { isApplied: false };
    }
    throw e;
  }
  if (!tab.url || !isStillSourceURL(tab.url, oldURL)) {
    return { isApplied: false };
  }

  try {
    await chrome.tabs.update(tabId, { url: newURL });
    return { isApplied: true };
  } catch (e) {
    if (isTabGoneError(e)) {
      return { isApplied: false };
    }
    throw e;
  }
}
