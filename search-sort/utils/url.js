function sortParams(currentParams, configParams, strict) {
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
    } else if (
      param.defaultValue !== null &&
      param.defaultValue !== undefined
    ) {
      sorted.append(param.key, param.defaultValue);
      addedKeys.add(param.key);
    }
  });

  if (!strict) {
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

function buildSortedURL(url, configParams, strict) {
  const urlObj = new URL(url);
  const sorted = sortParams(urlObj.searchParams, configParams, strict);
  urlObj.search = sorted.toString();
  return urlObj.toString();
}
