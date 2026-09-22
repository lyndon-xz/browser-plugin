import { buildDefaultParamRules } from "./utils/default-param-rules.js";
import { extractRootDomain } from "./utils/domain.js";
import { MESSAGE_ACTION } from "./utils/messages.js";
import { isTabGoneError } from "./utils/runtime-error.js";
import { StorageHelper } from "./utils/storage.js";
import { replaceURLInTab } from "./utils/tab.js";
import {
  PARAM_MODE,
  buildURLWithParamRules,
  isSupportedURL,
} from "./utils/url.js";

/*
 * service worker 负责 popup / content script 做不到的事：读 storage、按域名配置
 * 重排 URL、更新标签页图标，并串行化同一 tab 上的并发应用。
 *
 * 默认值的注入交给 declarativeNetRequest：在主文档请求发出前改写 URL，站点从头
 * 就读到默认值，不必加载完再改一次 URL 把页面重新请求一遍。
 * 页面加载完与 SPA 路由变化时只重排顺序——参数集没变，原地 replaceState 即可
 */

const ICON_SIZES = [16, 32, 48, 128];

const ICON_STATE = {
  active: "active",
  inactive: "inactive",
};

function buildIconSet(state) {
  return Object.fromEntries(
    ICON_SIZES.map((size) => [size, `icons/${state}/icon-${size}.png`]),
  );
}

const ICONS = {
  [ICON_STATE.active]: buildIconSet(ICON_STATE.active),
  [ICON_STATE.inactive]: buildIconSet(ICON_STATE.inactive),
};

function updateIcon(tabId, state) {
  if (tabId == null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    chrome.action.setIcon({ path: ICONS[state], tabId }, () => {
      const err = chrome.runtime.lastError;
      if (err && !isTabGoneError(err)) {
        console.warn("[search-sort] setIcon 失败：", err.message);
      }
      resolve();
    });
  });
}

function readConfigForURL(url) {
  return StorageHelper.getConfig(extractRootDomain(new URL(url).hostname));
}

const applyGeneration = new Map();

async function sortTabURL(tabId, url) {
  if (!isSupportedURL(url)) {
    return;
  }

  const generation = (applyGeneration.get(tabId) ?? 0) + 1;
  applyGeneration.set(tabId, generation);
  const isStale = () => applyGeneration.get(tabId) !== generation;

  try {
    const config = await readConfigForURL(url);

    if (isStale()) {
      return;
    }

    // 关掉开关后不再改 URL：分不清哪些参数是注入的，剔除会连用户自己带的一起删
    if (!config?.isEnabled) {
      await updateIcon(tabId, ICON_STATE.inactive);
      return;
    }

    const { params } = config;
    const sortedURL = buildURLWithParamRules(url, params, PARAM_MODE.sortOnly);

    if (isStale()) {
      return;
    }

    await replaceURLInTab({ tabId, oldURL: url, newURL: sortedURL });

    if (isStale()) {
      return;
    }

    await updateIcon(tabId, ICON_STATE.active);
  } catch (e) {
    // 这一轮没判出结果，图标不能继续沿用上一轮的「已生效」
    await updateIcon(tabId, ICON_STATE.inactive);
    console.error("[search-sort] 重排失败：", e);
  }
}

/*
 * popup 保存后只刷新图标：URL 已由 popup 按新配置应用过，这里再算一遍拿到的是
 * 保存前的旧 URL，会把用户刚剔除的参数加回去
 */
async function updateIconForTab(tabId, url) {
  if (!isSupportedURL(url)) {
    return;
  }

  try {
    const config = await readConfigForURL(url);
    await updateIcon(
      tabId,
      config?.isEnabled ? ICON_STATE.active : ICON_STATE.inactive,
    );
  } catch (e) {
    await updateIcon(tabId, ICON_STATE.inactive);
    console.error("[search-sort] 刷新图标失败：", e);
  }
}

const HANDLERS = {
  [MESSAGE_ACTION.urlChanged]: (message, sender) => {
    if (sender.tab) {
      void sortTabURL(sender.tab.id, message.url);
    }
  },
  [MESSAGE_ACTION.configUpdated]: (message) => {
    void updateIconForTab(message.tabId, message.url);
  },
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  /*
   * 开始加载就先置未生效：这一轮还没判出结果，留着上一个 URL 算出的
   * active 图标会让用户以为当前页正在被重排
   */
  if (changeInfo.status === "loading") {
    void updateIcon(tabId, ICON_STATE.inactive);
    return;
  }

  if (changeInfo.status === "complete" && tab.url) {
    void sortTabURL(tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  applyGeneration.delete(tabId);
});

/*
 * 动态规则整批重建，不做增量：规则完全由配置推导，重算一遍比维护「哪条对应哪个
 * 参数」更不容易错。规则本身持久保存，service worker 被回收也不受影响
 */
async function syncDefaultParamRules() {
  try {
    const configs = await StorageHelper.getAllConfigs();
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRules.map((rule) => rule.id),
      addRules: buildDefaultParamRules(configs),
    });
  } catch (e) {
    console.error("[search-sort] 下发默认值注入规则失败：", e);
  }
}

StorageHelper.onConfigsChanged(() => void syncDefaultParamRules());

// 安装与升级后重建一次：规则可能是旧版本格式，或安装前就已有配置
chrome.runtime.onInstalled.addListener(() => void syncDefaultParamRules());

chrome.runtime.onMessage.addListener((message, sender) => {
  const handler = HANDLERS[message?.action];
  if (handler) {
    handler(message, sender);
  }
});
