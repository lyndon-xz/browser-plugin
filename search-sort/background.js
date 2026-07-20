importScripts(
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

async function applyConfigToTab(tabId, url) {
  if (!url || !url.startsWith("http")) return;

  try {
    const rootDomain = extractRootDomain(new URL(url).hostname);
    const config = await StorageHelper.getConfig(rootDomain);

    if (config && config.enabled) {
      // strict=false：保留配置外的现有参数，只做排序 / 注入默认值
      const newURL = buildSortedURL(url, config.params, false);
      await applyURLToTab({ tabId, oldURL: url, newURL, config });
      updateIcon(tabId, "active");
    } else {
      updateIcon(tabId, "inactive");
    }
  } catch (e) {
    // URL 不合法或标签页尚未就绪，属预期忽略路径，仅记录便于排查
    console.debug("applyConfigToTab skipped:", e);
  }
}

function updateIcon(tabId, state) {
  const path = state === "active" ? ICONS.active : ICONS.inactive;
  chrome.action.setIcon({ path, tabId });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    applyConfigToTab(tabId, tab.url);
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === "urlChanged" && sender.tab) {
    applyConfigToTab(sender.tab.id, message.url);
  }
  if (message.action === "configUpdated" && message.tabId) {
    applyConfigToTab(message.tabId, message.url);
  }
});
