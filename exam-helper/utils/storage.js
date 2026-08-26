/**
 * StorageHelper：封装 chrome.storage.local 的“启用状态”读写。
 *
 * 支撑 V-4（Alt+Q 全局开关）：读写扩展是否启用的持久化状态。
 *
 * 设计要点（architecture.md TD-2）：
 *   - UMD 包装：浏览器作普通脚本加载时挂全局；Node/Vitest 下可 require/import。
 *   - MV3 的 chrome.storage.local.get/set 支持 Promise 形式，直接 await。
 *   - 对 chrome 未定义 / 读取异常做健壮处理，读失败时回退默认值 true。
 *
 * API（均返回 Promise）：
 *   - getEnabled(): Promise<boolean>  未设置时返回默认值 true
 *   - setEnabled(bool): Promise<void>
 */
(function (global) {
  "use strict";

  const KEY = "enabled";
  const DEFAULT_ENABLED = true;

  const StorageHelper = {
    /**
     * 读取启用状态；未设置或读取失败时回退默认值 true。
     * @returns {Promise<boolean>}
     */
    async getEnabled() {
      try {
        if (
          typeof chrome === "undefined" ||
          !chrome.storage ||
          !chrome.storage.local
        ) {
          return DEFAULT_ENABLED;
        }
        const result = await chrome.storage.local.get(KEY);
        if (result && typeof result[KEY] === "boolean") {
          return result[KEY];
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
      if (
        typeof chrome === "undefined" ||
        !chrome.storage ||
        !chrome.storage.local
      ) {
        return;
      }
      await chrome.storage.local.set({ [KEY]: Boolean(bool) });
    },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { StorageHelper };
  } else {
    global.StorageHelper = StorageHelper;
  }
})(typeof self !== "undefined" ? self : this);
