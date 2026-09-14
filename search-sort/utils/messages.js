/** background、content script、popup 三方共享的消息协议，任一端改名需三处同步 */
export const MESSAGE_ACTION = {
  // content script → background：页面内软跳转导致 URL 变化
  urlChanged: "urlChanged",
  // background → content script：把重排后的 URL 原地替换上去
  apply: "apply",
  // popup → background：配置已保存，据此刷新图标
  configUpdated: "configUpdated",
};

/** 统一的调用口：service worker 回传的失败在这里还原成异常，调用点不必各写一遍 isOk 判断 */
export async function ask(action, payload = {}) {
  const reply = await chrome.runtime.sendMessage({ action, ...payload });
  if (!reply?.isOk) {
    throw new Error(reply?.error ?? "扩展后台没有响应");
  }
  return reply.result;
}
