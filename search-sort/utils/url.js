/*
 * 参数处理模式，决定配置外的现有参数怎么办：
 * - configOnly：以配置为准，剔除配置外的参数（popup 保存时用）
 * - keepExtra：保留配置外的参数，只做排序与默认值注入（自动应用时用）
 */
export const PARAM_MODE = {
  configOnly: "config-only",
  keepExtra: "keep-extra",
};

export function isSupportedURL(url) {
  return Boolean(url) && url.startsWith("http");
}

export function emptyDefaultToNull(value) {
  return value === "" ? null : value;
}

/** 只比较查询参数多重集，pathname / hash 不在范围内 */
export function hasSameSearchParams(a, b) {
  const normalize = (u) =>
    [...new URL(u).searchParams.entries()].sort().toString();
  return normalize(a) === normalize(b);
}

// 按配置顺序重排现有参数，并为配置里给了默认值、URL 上却缺失的参数注入默认值
function applyParamRules(currentParams, configParams, mode) {
  const currentMap = new Map();

  for (const [key, value] of currentParams) {
    if (!currentMap.has(key)) {
      currentMap.set(key, []);
    }
    currentMap.get(key).push(value);
  }

  const sorted = new URLSearchParams();
  const addedKeys = new Set();

  configParams.forEach((param) => {
    const { key, defaultValue } = param;

    if (currentMap.has(key)) {
      currentMap.get(key).forEach((value) => {
        sorted.append(key, value);
      });
      addedKeys.add(key);
    } else if (defaultValue != null && defaultValue !== "") {
      sorted.append(key, defaultValue);
      addedKeys.add(key);
    }
  });

  if (mode === PARAM_MODE.keepExtra) {
    for (const [key, values] of currentMap) {
      if (!addedKeys.has(key)) {
        values.forEach((value) => {
          sorted.append(key, value);
        });
      }
    }
  }

  return sorted;
}

export function buildURLWithParamRules(url, configParams, mode) {
  const urlObj = new URL(url);
  urlObj.search = applyParamRules(
    urlObj.searchParams,
    configParams,
    mode,
  ).toString();
  return urlObj.toString();
}

// 禁用时去掉配置注入的默认值，只保留 URL 上已有的参数
export function buildURLWithoutConfig(url, configParams) {
  const urlObj = new URL(url);
  const existingKeys = new Set(urlObj.searchParams.keys());
  const kept = configParams
    .filter((param) => existingKeys.has(param.key))
    .map((param) => ({
      key: param.key,
      defaultValue: urlObj.searchParams.get(param.key),
    }));
  return buildURLWithParamRules(url, kept, PARAM_MODE.configOnly);
}
