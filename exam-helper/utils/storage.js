/**
 * StorageHelper：封装 chrome.storage.local 的启用状态与 API key。
 *
 * 支撑 V-4（Alt+Q 开关）与 V-8（popup 本机密钥）。
 *
 * UMD：浏览器普通脚本 / importScripts 挂全局。
 */
(function (global) {
  "use strict";

  const ENABLED_KEY = "enabled";
  const API_KEY = "deepseekApiKey";
  const DEFAULT_ENABLED = true;

  function hasLocalStorage() {
    return (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    );
  }

  const StorageHelper = {
    /**
     * 读取启用状态；未设置或读取失败时回退默认值 true。
     * @returns {Promise<boolean>}
     */
    async getEnabled() {
      try {
        if (!hasLocalStorage()) return DEFAULT_ENABLED;
        const result = await chrome.storage.local.get(ENABLED_KEY);
        if (result && typeof result[ENABLED_KEY] === "boolean") {
          return result[ENABLED_KEY];
        }
        return DEFAULT_ENABLED;
      } catch (e) {
        return DEFAULT_ENABLED;
      }
    },

    /**
     * 写入启用状态。
     * @param {boolean} bool
     * @returns {Promise<void>}
     */
    async setEnabled(bool) {
      if (!hasLocalStorage()) return;
      await chrome.storage.local.set({ [ENABLED_KEY]: Boolean(bool) });
    },

    /**
     * 读取本机 DeepSeek API key；未设置返回空字符串。
     * @returns {Promise<string>}
     */
    async getApiKey() {
      try {
        if (!hasLocalStorage()) return "";
        const result = await chrome.storage.local.get(API_KEY);
        const value = result && result[API_KEY];
        return typeof value === "string" ? value.trim() : "";
      } catch (e) {
        return "";
      }
    },

    /**
     * 写入本机 DeepSeek API key（trim 后存储）。
     * @param {string} key
     * @returns {Promise<void>}
     */
    async setApiKey(key) {
      if (!hasLocalStorage()) return;
      const trimmed = String(key == null ? "" : key).trim();
      await chrome.storage.local.set({ [API_KEY]: trimmed });
    },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { StorageHelper };
  } else {
    global.StorageHelper = StorageHelper;
  }
})(typeof self !== "undefined" ? self : this);
