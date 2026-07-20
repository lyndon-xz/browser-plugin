const StorageHelper = {
  async getConfig(rootDomain) {
    const result = await chrome.storage.local.get("configs");
    const configs = result.configs || {};
    return configs[rootDomain] || null;
  },

  async setConfig(rootDomain, config) {
    const result = await chrome.storage.local.get("configs");
    const configs = result.configs || {};
    configs[rootDomain] = config;
    await chrome.storage.local.set({ configs });
  },
};
