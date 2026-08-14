// 全部域名配置的落盘根键，值结构为 { [rootDomain]: { enabled, params } }
const CONFIGS_STORAGE_KEY = "configs";

async function readConfigs() {
  const result = await chrome.storage.local.get(CONFIGS_STORAGE_KEY);
  return result[CONFIGS_STORAGE_KEY] || {};
}

const StorageHelper = {
  async getConfig(rootDomain) {
    const configs = await readConfigs();
    return configs[rootDomain] || null;
  },

  async setConfig(rootDomain, config) {
    const configs = await readConfigs();
    configs[rootDomain] = config;
    await chrome.storage.local.set({ [CONFIGS_STORAGE_KEY]: configs });
  },
};
