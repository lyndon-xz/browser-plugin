/**
 * 后台 service worker background.js（M1-S6，对应验收 V-4）
 *
 * 职责：监听 Alt+Q 全局快捷键（commands: toggle-enable），翻转启用状态，
 *   更新扩展图标（active/inactive），并通知当前标签的 content script。
 *   （M3 阶段在此扩展 DeepSeek API 代理。）
 */
importScripts("utils/storage.js");

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

async function applyIcon(enabled) {
  try {
    await chrome.action.setIcon({
      path: enabled ? ICONS.active : ICONS.inactive,
    });
  } catch (e) {
    // 图标设置失败不影响核心功能
  }
}

// 启动时按存储状态同步一次图标
(async function initIcon() {
  const enabled = await StorageHelper.getEnabled();
  applyIcon(enabled);
})();

// Alt+Q → 翻转启用状态 → 更新图标 → 通知当前标签
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-enable") return;

  const current = await StorageHelper.getEnabled();
  const next = !current;
  await StorageHelper.setEnabled(next);
  await applyIcon(next);

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab && tab.id != null) {
      chrome.tabs.sendMessage(tab.id, { action: "toggle", enabled: next });
    }
  } catch (e) {
    // 无可通知的标签（如 chrome:// 页面）时忽略
  }
});
