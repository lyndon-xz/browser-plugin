const SECOND_LEVEL_TLDS = new Set([
  "com.cn",
  "net.cn",
  "org.cn",
  "gov.cn",
  "co.jp",
  "co.uk",
  "co.kr",
  "co.in",
  "com.au",
  "com.br",
  "com.tw",
  "com.hk",
  "net.au",
  "org.uk",
  "ac.uk",
]);

// IPv4（四段纯数字）或 IPv6（含 ":"/方括号）等非域名主机：直接用完整
// hostname 作为配置键，避免按末两段截取导致不同 IP（如 10.0.0.1 与 20.0.0.1）
// 键相互碰撞、配置被套用到无关站点
function isIpHost(hostname) {
  if (hostname.includes(":") || hostname.includes("[")) return true;
  const parts = hostname.split(".");
  return parts.length === 4 && parts.every((part) => /^\d+$/.test(part));
}

function extractRootDomain(hostname) {
  const host = hostname.toLowerCase();
  if (isIpHost(host)) return host;

  const parts = host.split(".");
  if (parts.length <= 2) return host;

  const lastTwo = parts.slice(-2).join(".");
  if (SECOND_LEVEL_TLDS.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}
