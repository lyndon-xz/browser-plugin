/*
 * 为用户新增的 GitLab 站点动态注册 content script，分两步各在一侧：requestOriginAccess 要在
 * 扩展页面的用户手势同步上下文里调（设置页 click 处理器的第一句，之前不能有 await），
 * 放到 service worker 里会抛「must be called during a user gesture」；registerOriginScripts
 * 只有 service worker 能做。传入 chrome 而不是引用全局，让调用方明确自己在哪一侧。
 */

/** 只接受 origin 本身：带路径或缺协议的都会让 match 模式失效 */
export const ORIGIN_PATTERN = /^https?:\/\/[^/]+$/;

export const patternFor = (origin) => `${origin}/*`;

const scriptIdFor = (origin) => `review-lens-${origin}`;

// 与 manifest.json content_scripts[0].js 同源：动态注册必须注入同一份引导脚本
const contentScriptFiles = (chromeApi) =>
  chromeApi.runtime.getManifest().content_scripts[0].js;

/** 同步发起：返回的是 chrome 给的那个 promise，调用方 await 它，但不要在它之前 await 别的 */
export function requestOriginAccess(chrome, origin) {
  if (!ORIGIN_PATTERN.test(String(origin ?? ""))) {
    return Promise.resolve(false);
  }

  return chrome.permissions.request({ origins: [patternFor(origin)] });
}

export async function registerOriginScripts(chrome, origin) {
  if (!ORIGIN_PATTERN.test(String(origin ?? ""))) {
    return { isOk: false, reason: "bad-origin" };
  }

  let existing = [];
  try {
    existing = await chrome.scripting.getRegisteredContentScripts();
  } catch {
    // 查不到已注册列表就按「没注册过」继续，重复 id 在下面会被当成无害
    existing = [];
  }
  if (existing.some((script) => script.id === scriptIdFor(origin))) {
    return { isOk: true };
  }

  try {
    await chrome.scripting.registerContentScripts([
      {
        id: scriptIdFor(origin),
        matches: [patternFor(origin)],
        js: contentScriptFiles(chrome),
        runAt: "document_idle",
      },
    ]);
    return { isOk: true };
  } catch (error) {
    // 除了重复 id，其余（路径写错、超出配额、matches 不合法）都要报出去，否则站点静默不生效
    return { isOk: false, reason: "register-failed", message: error.message };
  }
}

/**
 * 两步都要报结果：注销失败却回一句「已移除」，脚本仍在注入、站点仍被授权，
 * 而列表里已经看不到它——连再移除一次的入口都没了。
 */
export async function unregisterOrigin(chrome, origin) {
  const failures = [];

  try {
    await chrome.scripting.unregisterContentScripts({
      ids: [scriptIdFor(origin)],
    });
  } catch (error) {
    failures.push(`脚本仍在注入（${error.message}）`);
  }

  // 权限也一并交还：只从列表里划掉，站点仍被授权且脚本仍在注入，是说一套做一套
  try {
    await chrome.permissions.remove({ origins: [patternFor(origin)] });
  } catch (error) {
    failures.push(`站点仍被授权（${error.message}）`);
  }

  return failures.length
    ? { isOk: false, message: failures.join("；") }
    : { isOk: true };
}
