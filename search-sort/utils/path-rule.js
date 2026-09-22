/*
 * background / popup 直接匹配 pathname，DNR 的 regexFilter 只能匹配整条 URL，两边都从
 * compile() 的同一份结果出发，否则两处生效的页面不是同一批。为了能翻译过去，写法上有两条
 * 硬约束，写不了的形态在保存前就被拦下：必须以 / 开头，要模糊匹配用 /.*search 这种写法；
 * ^ 与 $ 只能落在整条正则的两端，分支中间的锚点翻译不过去
 */

// 主机段不含 /，紧跟其后的那个 / 必然是路径的第一个字符，路径边界由此钉死
const URL_HOST_FRAME = "^https?://[^/?#]*";

/** 校验失败的原因，popup 据此给出对应提示 */
export const PATH_PATTERN_ERROR = {
  syntax: "syntax",
  mustStartWithSlash: "must-start-with-slash",
  innerAnchor: "inner-anchor",
  unsupportedByRules: "unsupported-by-rules",
};

/** 去空格；空串与缺失都归一为「不限路径」 */
export function normalizePathPattern(rawPattern) {
  const pattern = typeof rawPattern === "string" ? rawPattern.trim() : "";
  return pattern === "" ? null : pattern;
}

// 校验、pathname 匹配、DNR 翻译共用这一份结果，三处不会对同一个 pattern 有两种理解
function compile(pattern) {
  const body = pattern.startsWith("^") ? pattern.slice(1) : pattern;
  if (!body.startsWith("/")) {
    return { error: PATH_PATTERN_ERROR.mustStartWithSlash };
  }

  let compiled = "";
  let isAnchoredToPathEnd = false;
  let isEscaped = false;
  let isInCharClass = false;

  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];

    if (isEscaped) {
      compiled += char;
      isEscaped = false;
    } else if (char === "\\") {
      compiled += char;
      isEscaped = true;
    } else if (isInCharClass) {
      compiled += char;
      isInCharClass = char !== "]";
    } else if (char === "[") {
      compiled += char;
      isInCharClass = true;
    } else if (char === ".") {
      // 裸 . 不许跨过 ? 吃进查询串，否则 DNR 侧会在 pathname 并不命中的页面上生效
      compiled += "[^?#]";
    } else if (char === "$" && i === body.length - 1) {
      isAnchoredToPathEnd = true;
    } else if (char === "^" || char === "$") {
      return { error: PATH_PATTERN_ERROR.innerAnchor };
    } else {
      compiled += char;
    }
  }

  return { compiled, isAnchoredToPathEnd };
}

// 整体套一层分组：不套的话 ^ 只作用于第一个分支
function toPathnameRegex(result) {
  const { compiled, isAnchoredToPathEnd } = result;
  return `^(?:${compiled})${isAnchoredToPathEnd ? "$" : ""}`;
}

/** 结构校验：能不能编译成两个消费方都用得上的形态。返回 { isValid, reason } */
export function validatePathPattern(pattern) {
  if (pattern == null) {
    return { isValid: true };
  }

  const result = compile(pattern);
  if (result.error) {
    return { isValid: false, reason: result.error };
  }

  try {
    new RegExp(toPathnameRegex(result));
  } catch {
    return { isValid: false, reason: PATH_PATTERN_ERROR.syntax };
  }
  return { isValid: true };
}

/**
 * pathname 是否命中；pattern 为空表示不限路径。
 * 编译不了时按不命中处理——宁可不生效，也不要在没打算配的页面上改 URL
 */
export function matchesPathPattern(pathname, pattern) {
  if (pattern == null) {
    return true;
  }

  const result = compile(pattern);
  if (result.error) {
    return false;
  }

  try {
    return new RegExp(toPathnameRegex(result)).test(pathname);
  } catch {
    return false;
  }
}

/** 翻译成 DNR regexFilter 用的整条 URL 正则；返回 null 表示别下发规则，而非放宽到整个域名 */
export function toURLRegex(pattern) {
  if (pattern == null) {
    return null;
  }

  const result = compile(pattern);
  if (result.error) {
    return null;
  }

  const { compiled, isAnchoredToPathEnd } = result;
  const pathEnd = isAnchoredToPathEnd ? "(?:[?#]|$)" : "";
  return `${URL_HOST_FRAME}(?:${compiled})${pathEnd}`;
}

/** 配置对这个 URL 生效吗；图标、自动排序、保存时应用共用这一处判定 */
export function isConfigActiveForURL(config, url) {
  if (!config?.isEnabled) {
    return false;
  }
  return matchesPathPattern(new URL(url).pathname, config.pathPattern);
}
