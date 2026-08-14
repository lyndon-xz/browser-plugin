importScripts(
  "utils/message.js",
  "utils/domain.js",
  "utils/url.js",
  "utils/tab.js",
  "utils/storage.js",
);

const ICON_SIZES = [16, 32, 48, 128];

function buildIconSet(state) {
  return Object.fromEntries(
    ICON_SIZES.map((size) => [size, `icons/${state}/icon-${size}.png`]),
  );
}

const ICONS = {
  active: buildIconSet("active"),
  inactive: buildIconSet("inactive"),
};

function updateIcon(tabId, state) {
  return chrome.action.setIcon({ path: ICONS[state], tabId });
}

// 只有 http(s) 页面才有可排序的查询参数，chrome://、file:// 等一律跳过
function isSupportedURL(url) {
  return Boolean(url) && url.startsWith("http");
}

async function readConfigForURL(url) {
  const rootDomain = extractRootDomain(new URL(url).hostname);
  return StorageHelper.getConfig(rootDomain);
}

async function applyConfigToTab(tabId, url) {
  if (!isSupportedURL(url)) return;

  try {
    const config = await readConfigForURL(url);

    if (!config || !config.enabled) {
      await updateIcon(tabId, "inactive");
      return;
    }

    const newURL = buildURLWithParamRules(
      url,
      config.params,
      PARAM_MODE.keepExtra,
    );
    await applyURLToTab({ tabId, oldURL: url, newURL });
    await updateIcon(tabId, "active");
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
  if (!isSupportedURL(url)) return;

  try {
    const config = await readConfigForURL(url);
    await updateIcon(tabId, config?.enabled ? "active" : "inactive");
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
  if (message.action === MESSAGE_ACTION.urlChanged && sender.tab) {
    void applyConfigToTab(sender.tab.id, message.url);
  }
  if (message.action === MESSAGE_ACTION.configUpdated && message.tabId) {
    void updateIconForTab(message.tabId, message.url);
  }
});
