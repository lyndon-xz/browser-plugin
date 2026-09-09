import { extractRootDomain } from "./utils/domain.js";
import { MESSAGE_ACTION } from "./utils/message.js";
import { StorageHelper } from "./utils/storage.js";
import { applyURLToTab } from "./utils/tab.js";
import {
  PARAM_MODE,
  buildURLWithParamRules,
  isSupportedURL,
} from "./utils/url.js";

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
  return chrome.action.setIcon({ path: ICONS[state], tabId });
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
    if (!isEnabled) {
      await updateIcon(tabId, ICON_STATE.inactive);
      return;
    }

    const newURL = buildURLWithParamRules(url, params, PARAM_MODE.keepExtra);

    if (applyGeneration.get(tabId) !== generation) {
      return;
    }

    await applyURLToTab({ tabId, oldURL: url, newURL });

    if (applyGeneration.get(tabId) !== generation) {
      return;
    }

    await updateIcon(tabId, ICON_STATE.active);
  } catch (e) {
    // URL 不合法或标签页尚未就绪，属预期忽略路径，仅记录便于排查
    console.warn("applyConfigToTab skipped:", e);
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
    console.warn("updateIconForTab skipped:", e);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    void applyConfigToTab(tabId, tab.url);
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  const { action, url, tabId } = message;

  if (action === MESSAGE_ACTION.urlChanged && sender.tab) {
    void applyConfigToTab(sender.tab.id, url);
  }
  if (action === MESSAGE_ACTION.configUpdated && tabId) {
    void updateIconForTab(tabId, url);
  }
});
