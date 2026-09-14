/** 从 origin URL 取 hostname；解析失败则原样返回 */
export function hostOf(origin) {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

/** 同一 hostname 只保留一项（manifest 里 http/https 双写时合并） */
export function uniqueHosts(origins) {
  const seen = new Set();
  const hosts = [];
  for (const origin of origins) {
    const host = hostOf(origin);
    if (seen.has(host)) {
      continue;
    }
    seen.add(host);
    hosts.push(host);
  }
  return hosts;
}

/** 旧版用完整 origin 作键，读入时归一到 hostname */
export function tokensByHost(tokens) {
  const next = {};
  for (const [key, value] of Object.entries(tokens ?? {})) {
    if (value == null || value === "") {
      continue;
    }
    next[hostOf(key)] = value;
  }
  return next;
}

/** 按当前页 origin 的 hostname 取访问令牌 */
export function tokenForPage(tokens, pageOrigin) {
  return tokensByHost(tokens)[hostOf(pageOrigin)] ?? null;
}
