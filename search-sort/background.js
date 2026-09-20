import { extractRootDomain } from "./utils/domain.js";
import { MESSAGE_ACTION } from "./utils/messages.js";
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
 * 自动流程只重排参数顺序，不注入默认值、不剔除参数：参数集一变就得整页导航站点
 * 才读得到，页面状态会全丢。默认值改由用户在 popup 点「保存并应用」时生效
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

async function sortTabURL(tabId, url) {
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

    // 关掉开关后不再改 URL：分不清哪些参数是注入的，剔除会连用户自己带的一起删
    if (!config?.isEnabled) {
      await updateIcon(tabId, ICON_STATE.inactive);
      return;
    }

    const sortedURL = buildURLWithParamRules(
      url,
      config.params,
      PARAM_MODE.sortOnly,
    );

    if (applyGeneration.get(tabId) !== generation) {
      return;
    }

    await replaceURLInTab({ tabId, oldURL: url, newURL: sortedURL });

    if (applyGeneration.get(tabId) !== generation) {
      return;
    }

    await updateIcon(tabId, ICON_STATE.active);
  } catch (e) {
    console.warn("[search-sort] 重排跳过：", e);
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
      void sortTabURL(sender.tab.id, message.url);
    }
  },
  [MESSAGE_ACTION.configUpdated]: (message) => {
    void updateIconForTab(message.tabId, message.url);
  },
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    void sortTabURL(tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  applyGeneration.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, sender) => {
  const handler = HANDLERS[message?.action];
  if (handler) {
    handler(message, sender);
  }
});
