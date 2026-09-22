import { toURLRegex } from "./path-rule.js";

/*
 * 把域名配置编译成 declarativeNetRequest 动态规则：在主文档请求发出之前就把缺失的
 * 默认值补进 URL，页面从头带着它们加载——既不多发一次请求，也不刷新。
 * 规则由 background 下发（依赖 chrome.declarativeNetRequest）
 */

// 同一请求里高优先级规则胜出，skip 因此能挡住 inject
const RULE_PRIORITY = {
  inject: 1,
  skip: 2,
};

/*
 * requestDomains 只收普通主机名。IPv6 主机的配置键形如 [::1]，塞进去会让整批规则
 * 被 Chrome 拒掉，这里先滤掉；它们仍有自动排序与保存时注入
 */
const isPlainHost = (rootDomain) => /^[a-z0-9.-]+$/.test(rootDomain);

// regexFilter 走 RE2，元字符要转义
const escapeForRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * DNR 的 regexFilter 走 RE2，JS RegExp 能编译的它未必收（前后向断言、反向引用）。
 * 而 updateDynamicRules 是整批原子提交，一条不收就没有任何域名的规则能下发成功，
 * 所以 popup 保存前问一遍、background 下发前再兜一遍
 */
export async function isPathPatternSupportedByRules(pathPattern) {
  const urlRegex = toURLRegex(pathPattern);
  if (urlRegex === null) {
    return true;
  }

  const { isSupported } = await chrome.declarativeNetRequest.isRegexSupported({
    regex: urlRegex,
    isCaseSensitive: true,
  });
  return isSupported;
}

function buildDomainRules(rootDomain, config, firstRuleId) {
  const { pathPattern, params } = config;
  const defaulted = params.filter((param) => param.defaultValue != null);
  if (defaulted.length === 0) {
    return [];
  }

  const pathURLRegex = toURLRegex(pathPattern);
  // 配了路径却翻译不出来：宁可不注入，也不要把作用范围放大回整个域名
  if (pathPattern !== null && pathURLRegex === null) {
    return [];
  }

  const condition = {
    requestDomains: [rootDomain],
    resourceTypes: ["main_frame"],
    // 参数名与路径都区分大小写，?A= 与 ?a= 是两个参数
    isUrlFilterCaseSensitive: true,
  };
  const anyDefaultedKey = defaulted
    .map((param) => escapeForRegex(param.key))
    .join("|");

  return [
    /*
     * skip 不带路径条件：路径不命中时 inject 本来就不匹配，多放行一条无妨，
     * 而 regexFilter 一条只能写一个，路径与「参数已存在」拼不到一起
     */
    {
      id: firstRuleId,
      priority: RULE_PRIORITY.skip,
      action: { type: "allow" },
      condition: { ...condition, regexFilter: `[?&](${anyDefaultedKey})=` },
    },
    {
      id: firstRuleId + 1,
      priority: RULE_PRIORITY.inject,
      action: {
        type: "redirect",
        redirect: {
          transform: {
            queryTransform: {
              addOrReplaceParams: defaulted.map((param) => {
                const { key, defaultValue } = param;
                return { key, value: defaultValue };
              }),
            },
          },
        },
      },
      condition: pathURLRegex
        ? { ...condition, regexFilter: pathURLRegex }
        : condition,
    },
  ];
}

/**
 * 每个启用的域名生成两条规则：
 * - inject：一次补齐该域名全部有默认值的参数
 * - skip：URL 上已经带了其中任意一个时整条放行
 *
 * allow 是按整个请求生效的，没法只放行某一个参数，所以「带了一个就一个都不补」是
 * 这套机制的下限。换来的是任何情况下都不会覆盖用户自己传的值——那比补全更重要
 */
export function buildDefaultParamRules(configs) {
  const rules = [];

  for (const [rootDomain, config] of Object.entries(configs)) {
    if (!config.isEnabled || !isPlainHost(rootDomain)) {
      continue;
    }
    rules.push(...buildDomainRules(rootDomain, config, rules.length + 1));
  }

  return rules;
}
