import { normalizePathPattern } from "./path-rule.js";
import { emptyDefaultToNull } from "./url.js";

// 全部域名配置的落盘根键，值结构为 { [rootDomain]: { isEnabled, pathPattern, params } }
const CONFIGS_STORAGE_KEY = "configs";

async function readConfigs() {
  const result = await chrome.storage.local.get(CONFIGS_STORAGE_KEY);
  return result[CONFIGS_STORAGE_KEY] || {};
}

function fromStored(config) {
  if (!config) {
    return null;
  }

  // enabled 是 2.0 之前的键名，只在这里兜底读，新数据不再写
  const { enabled, isEnabled, pathPattern, params } = config;
  return {
    isEnabled: isEnabled ?? enabled ?? false,
    // 3.3 之前没有这个字段，缺失即不限路径
    pathPattern: normalizePathPattern(pathPattern),
    params: Array.isArray(params)
      ? params.map((param) => {
          const { key, defaultValue } = param;
          return { key, defaultValue: emptyDefaultToNull(defaultValue) };
        })
      : [],
  };
}

/** 按根域名读写 URL 参数排序配置（chrome.storage.local） */
export const StorageHelper = {
  async getConfig(rootDomain) {
    const configs = await readConfigs();
    return fromStored(configs[rootDomain] || null);
  },

  /** 全部域名的配置，键为根域名；下发 DNR 规则时要一次看全 */
  async getAllConfigs() {
    const configs = await readConfigs();
    return Object.fromEntries(
      Object.entries(configs).map(([rootDomain, config]) => [
        rootDomain,
        fromStored(config),
      ]),
    );
  },

  /** 订阅任意域名的配置变更；storage 键名不外泄到调用方 */
  onConfigsChanged(listener) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes[CONFIGS_STORAGE_KEY]) {
        listener();
      }
    });
  },

  async setConfig(rootDomain, config) {
    const configs = await readConfigs();
    const { isEnabled, pathPattern, params } = config;
    configs[rootDomain] = { isEnabled, pathPattern, params };
    await chrome.storage.local.set({ [CONFIGS_STORAGE_KEY]: configs });
  },
};
