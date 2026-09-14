// 全部域名配置的落盘根键，值结构为 { [rootDomain]: { isEnabled, params } }
const CONFIGS_STORAGE_KEY = "configs";

async function readConfigs() {
  const result = await chrome.storage.local.get(CONFIGS_STORAGE_KEY);
  return result[CONFIGS_STORAGE_KEY] || {};
}

function fromStored(config) {
  if (!config) {
    return null;
  }

  const { enabled, isEnabled, params } = config;
  return {
    isEnabled: isEnabled ?? enabled ?? false,
    params: Array.isArray(params) ? params : [],
  };
}

function toStored(config) {
  return {
    isEnabled: config.isEnabled,
    enabled: config.isEnabled,
    params: config.params,
  };
}

/** 按根域名读写 URL 参数排序配置（chrome.storage.local） */
export const StorageHelper = {
  async getConfig(rootDomain) {
    const configs = await readConfigs();
    return fromStored(configs[rootDomain] || null);
  },

  async setConfig(rootDomain, config) {
    const configs = await readConfigs();
    configs[rootDomain] = toStored(config);
    await chrome.storage.local.set({ [CONFIGS_STORAGE_KEY]: configs });
  },
};
