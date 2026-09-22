import {
  buildDefaultParamRules,
  isPathPatternSupportedByRules,
} from "./utils/default-param-rules.js";
import { extractRootDomain } from "./utils/domain.js";
import { MESSAGE_ACTION } from "./utils/messages.js";
import { isConfigActiveForURL } from "./utils/path-rule.js";
import { isTabGoneError } from "./utils/runtime-error.js";
import { StorageHelper } from "./utils/storage.js";
import { replaceURLInTab } from "./utils/tab.js";
import {
  PARAM_MODE,
  buildURLWithParamRules,
  isSupportedURL,
} from "./utils/url.js";

/*
 * 默认值由 declarativeNetRequest 在主文档请求发出前注入，站点首个请求就读到默认值，
 * 不必等加载完再改 URL 重新请求一遍；页面就绪与 SPA 路由变化只原地重排顺序
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

  // 路径也在判据里，同域换路径就能翻转结论，先作废免得图标停在上一个路径的结果
  await updateIcon(tabId, ICON_STATE.inactive);

  try {
    const config = await readConfigForURL(url);

    if (isStale()) {
      return;
    }

    // 不生效时不动 URL：分不清哪些参数是注入的，剔除会连用户自己带的一起删
    if (!isConfigActiveForURL(config, url)) {
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
    // 图标在开头就已经置灰，这里不必再动：没判出结果就停在「未生效」上
    console.error("[search-sort] 重排失败：", e);
  }
}

/*
 * 只刷图标不重排：URL 已由 popup 按新配置应用过，这里读到的是保存前的旧 URL，
 * 再算一遍会把用户刚剔除的参数加回去
 */
async function updateIconForTab(tabId, url) {
  if (!isSupportedURL(url)) {
    return;
  }

  try {
    const config = await readConfigForURL(url);
    await updateIcon(
      tabId,
      isConfigActiveForURL(config, url)
        ? ICON_STATE.active
        : ICON_STATE.inactive,
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
  // 这一轮还没判出结果，留着上一个 URL 算出的 active 图标会误报
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

// popup 保存时已拦过一遍，这里兜住旧版本写进去的、手改 storage 进来的配置
async function dropRuleUnsafeConfigs(configs) {
  const checked = await Promise.all(
    Object.entries(configs).map(async (entry) => {
      const [rootDomain, config] = entry;
      if (await isPathPatternSupportedByRules(config.pathPattern)) {
        return entry;
      }
      console.warn(
        `[search-sort] ${rootDomain} 的路径正则 DNR 不支持，已跳过它的默认值注入：`,
        config.pathPattern,
      );
      return null;
    }),
  );
  return Object.fromEntries(checked.filter((entry) => entry !== null));
}

/*
 * 整批重建不做增量：规则完全由配置推导，重算比维护「哪条对应哪个参数」更不易错。
 * 动态规则本身持久保存，service worker 被回收也不受影响
 */
async function syncDefaultParamRules() {
  try {
    const configs = await StorageHelper.getAllConfigs();
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRules.map((rule) => rule.id),
      addRules: buildDefaultParamRules(await dropRuleUnsafeConfigs(configs)),
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
