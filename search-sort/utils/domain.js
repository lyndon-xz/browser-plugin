/*
 * 常见的二级 TLD。这份清单按定义不可能穷尽，未收录的后缀会让同后缀的不同站点
 * （如 a.example.cn 与 b.example.cn）落到同一个配置键上、配置互相串用；
 * popup 顶部展示的就是实际生效的配置键，串用时用户能直接看见
 */
const SECOND_LEVEL_TLDS = new Set([
  "com.cn",
  "net.cn",
  "org.cn",
  "gov.cn",
  "edu.cn",
  "ac.cn",
  "co.jp",
  "ne.jp",
  "or.jp",
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "co.kr",
  "co.in",
  "co.nz",
  "co.za",
  "co.th",
  "co.il",
  "com.au",
  "net.au",
  "org.au",
  "com.br",
  "com.tw",
  "com.hk",
  "com.sg",
  "com.my",
  "com.ph",
  "com.vn",
  "com.tr",
  "com.mx",
  "com.ar",
]);

/*
 * IPv4（四段纯数字）或 IPv6（含 ":"/方括号）等非域名主机：直接用完整
 * hostname 作为配置键，避免按末两段截取导致不同 IP（如 10.0.0.1 与 20.0.0.1）
 * 键相互碰撞、配置被套用到无关站点
 */
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
