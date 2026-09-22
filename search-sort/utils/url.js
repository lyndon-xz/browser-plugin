/** 仅 http(s) 页面可配置查询参数 */
export function isSupportedURL(url) {
  return Boolean(url) && url.startsWith("http");
}

/*
 * 默认值「未设置」的唯一关口：空串与缺失一律归一为 null，
 * 之后各处只判 null，不必各自再防一遍 "" 与 undefined
 */
export function emptyDefaultToNull(value) {
  return value === "" || value == null ? null : value;
}

/** 只比较查询参数多重集，pathname / hash 不在范围内 */
export function hasSameSearchParams(oneURL, otherURL) {
  const normalize = (url) =>
    [...new URL(url).searchParams.entries()].sort().toString();
  return normalize(oneURL) === normalize(otherURL);
}

/**
 * 参数处理模式：
 * - sortOnly：只按配置顺序重排现有参数，保留配置外的参数，不注入默认值。
 *   产出与输入是同一个参数多重集，因此能原地替换 URL、不必重新请求页面（自动应用时用）
 * - configOnly：以配置为准，剔除配置外的参数并注入缺失的默认值。
 *   参数集会变，需要整页导航才能让站点读到（popup 保存时用）
 */
export const PARAM_MODE = {
  sortOnly: "sort-only",
  configOnly: "config-only",
};

function applyParamRules(currentParams, configParams, mode) {
  const valuesByKey = new Map();

  for (const [key, value] of currentParams) {
    if (!valuesByKey.has(key)) {
      valuesByKey.set(key, []);
    }
    valuesByKey.get(key).push(value);
  }

  const isConfigOnly = mode === PARAM_MODE.configOnly;
  const sorted = new URLSearchParams();
  const addedKeys = new Set();

  configParams.forEach((param) => {
    const { key, defaultValue } = param;

    if (valuesByKey.has(key)) {
      valuesByKey.get(key).forEach((value) => {
        sorted.append(key, value);
      });
      addedKeys.add(key);
    } else if (isConfigOnly && defaultValue != null) {
      sorted.append(key, defaultValue);
      addedKeys.add(key);
    }
  });

  if (!isConfigOnly) {
    for (const [key, values] of valuesByKey) {
      if (!addedKeys.has(key)) {
        values.forEach((value) => {
          sorted.append(key, value);
        });
      }
    }
  }

  return sorted;
}

/** 按配置顺序重排参数，并按 mode 决定是否注入默认值、是否保留配置外的现有参数 */
export function buildURLWithParamRules(url, configParams, mode) {
  const urlObj = new URL(url);
  urlObj.search = applyParamRules(
    urlObj.searchParams,
    configParams,
    mode,
  ).toString();
  return urlObj.toString();
}
