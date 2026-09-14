import { extractRootDomain } from "./utils/domain.js";
import { MESSAGE_ACTION } from "./utils/messages.js";
import { StorageHelper } from "./utils/storage.js";
import { applyURLToTab, forgetTab } from "./utils/tab.js";
import {
  PARAM_MODE,
  buildURLWithParamRules,
  buildURLWithoutConfig,
  isSupportedURL,
} from "./utils/url.js";

/*
 * service worker 负责 popup / content script 做不到的事：读 storage、按域名配置
 * 重排 URL、更新标签页图标，并串行化同一 tab 上的并发应用。
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

const isTabGoneError = (error) =>
  /No tab with id/i.test(error?.message ?? String(error));

const goneTabs = new Set();
chrome.tabs.onRemoved.addListener((tabId) => {
  goneTabs.add(tabId);
});

function updateIcon(tabId, state) {
  if (tabId == null || goneTabs.has(tabId)) {
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
  const rootDomain = extractRootDomain(new URL(url).hostname);
  return StorageHelper.getConfig(rootDomain);
}

const applyGeneration = new Map();

async function applyConfigToTab(tabId, url) {
  if (!isSupportedURL(url)) {
    return;
  }

  const generation = (applyGeneration.get(tabId) ?? 0) + 1;
  applyGeneration.set(tabId, generation);

  try {
    const config = await readConfigForURL(url);

    if (applyGeneration.get(tabId) !== generation) {
      return;
    }

    if (!config) {
      await updateIcon(tabId, ICON_STATE.inactive);
      return;
    }

    const { isEnabled, params } = config;
    const newURL = isEnabled
      ? buildURLWithParamRules(url, params, PARAM_MODE.keepExtra)
      : buildURLWithoutConfig(url, params);

    if (applyGeneration.get(tabId) !== generation) {
      return;
    }

    await applyURLToTab({ tabId, oldURL: url, newURL });

    if (applyGeneration.get(tabId) !== generation) {
      return;
    }

    await updateIcon(
      tabId,
      isEnabled ? ICON_STATE.active : ICON_STATE.inactive,
    );
  } catch (e) {
    console.warn("[search-sort] 应用配置跳过：", e);
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
    console.warn("[search-sort] 刷新图标跳过：", e);
  }
}

const HANDLERS = {
  [MESSAGE_ACTION.urlChanged]: (message, sender) => {
    if (sender.tab) {
      void applyConfigToTab(sender.tab.id, message.url);
    }
  },
  [MESSAGE_ACTION.configUpdated]: (message) => {
    void updateIconForTab(message.tabId, message.url);
  },
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    void applyConfigToTab(tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  applyGeneration.delete(tabId);
  forgetTab(tabId);
});

chrome.runtime.onMessage.addListener((message, sender) => {
  const handler = HANDLERS[message?.action];
  if (handler) {
    handler(message, sender);
  }
});
