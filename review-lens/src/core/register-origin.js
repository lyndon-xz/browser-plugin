/*
 * 为用户新增的 GitLab 站点动态注册 content script。
 * 传入 chrome 而不是直接引用全局，是为了能在 jsdom 里测。
 */

// 只接受 origin 本身：带路径或缺协议的都会让 match 模式失效
const IS_ORIGIN = /^https?:\/\/[^/]+$/;

export async function registerOrigin(chrome, origin) {
  if (!IS_ORIGIN.test(String(origin ?? ""))) return { granted: false, reason: "bad-origin" };

  const pattern = `${origin}/*`;
  const granted = await chrome.permissions.request({ origins: [pattern] });
  if (!granted) return { granted: false };

  try {
    await chrome.scripting.registerContentScripts([
      {
        id: `review-lens-${origin}`,
        matches: [pattern],
        js: ["content/bootstrap.js"],
        runAt: "document_idle",
      },
    ]);
  } catch {
    // 同一个站点重复添加会撞 id，权限已经拿到、脚本也早已注册，不是错误
  }

  return { granted: true };
}

export async function unregisterOrigin(chrome, origin) {
  await chrome.scripting.unregisterContentScripts({ ids: [`review-lens-${origin}`] }).catch(() => {});
}
