/** chrome.storage.local 键名：popup / background / content 须共用此对象 */

export const STORAGE_KEYS = {
  enabled: "enabled",
  apiKey: "deepseekApiKey",
};

const DEFAULT_ENABLED = false;

function hasLocalStorage() {
  return (
    typeof chrome !== "undefined" && chrome.storage && chrome.storage.local
  );
}

/** chrome.storage.local：扩展启用开关与 DeepSeek API 密钥 */
export const StorageHelper = {
  /** 读取启用状态；未设置或读取失败时回退默认值 false。 */
  async getEnabled() {
    try {
      if (!hasLocalStorage()) return DEFAULT_ENABLED;
      const result = await chrome.storage.local.get(STORAGE_KEYS.enabled);
      if (result && typeof result[STORAGE_KEYS.enabled] === "boolean") {
        return result[STORAGE_KEYS.enabled];
      }
      return DEFAULT_ENABLED;
    } catch (e) {
      return DEFAULT_ENABLED;
    }
  },

  /** 写入启用状态。 */
  async setEnabled(bool) {
    if (!hasLocalStorage()) return;
    await chrome.storage.local.set({
      [STORAGE_KEYS.enabled]: Boolean(bool),
    });
  },

  /** 读取本机 DeepSeek API key；未设置返回空字符串。 */
  async getApiKey() {
    try {
      if (!hasLocalStorage()) return "";
      const result = await chrome.storage.local.get(STORAGE_KEYS.apiKey);
      const value = result && result[STORAGE_KEYS.apiKey];
      return typeof value === "string" ? value.trim() : "";
    } catch (e) {
      return "";
    }
  },

  /** 写入本机 DeepSeek API key（trim 后存储）。 */
  async setApiKey(key) {
    if (!hasLocalStorage()) return;
    const trimmed = String(key == null ? "" : key).trim();
    await chrome.storage.local.set({ [STORAGE_KEYS.apiKey]: trimmed });
  },
};

/** 监听 chrome.storage.local 变更；popup 等 UI 用此订阅，避免硬编码键名。 */
export function watchLocalStorage(callback) {
  if (!hasLocalStorage()) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    callback(changes);
  });
}
