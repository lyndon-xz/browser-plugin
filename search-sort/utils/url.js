/*
 * 参数处理模式，决定配置外的现有参数怎么办：
 * - configOnly：以配置为准，剔除配置外的参数（popup 保存时用）
 * - keepExtra：保留配置外的参数，只做排序与默认值注入（自动应用时用）
 */
const PARAM_MODE = {
  configOnly: "config-only",
  keepExtra: "keep-extra",
};

// 按配置顺序重排现有参数，并为配置里给了默认值、URL 上却缺失的参数注入默认值
function applyParamRules(currentParams, configParams, mode) {
  const sorted = new URLSearchParams();
  const currentMap = new Map();

  for (const [key, value] of currentParams) {
    if (!currentMap.has(key)) {
      currentMap.set(key, []);
    }
    currentMap.get(key).push(value);
  }

  const addedKeys = new Set();

  configParams.forEach((param) => {
    if (currentMap.has(param.key)) {
      currentMap.get(param.key).forEach((value) => {
        sorted.append(param.key, value);
      });
      addedKeys.add(param.key);
    } else if (param.defaultValue != null) {
      sorted.append(param.key, param.defaultValue);
      addedKeys.add(param.key);
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

function buildURLWithParamRules(url, configParams, mode) {
  const urlObj = new URL(url);
  urlObj.search = applyParamRules(
    urlObj.searchParams,
    configParams,
    mode,
  ).toString();
  return urlObj.toString();
}
