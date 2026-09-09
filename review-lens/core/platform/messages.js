/** content script、service worker、popup 三方共享的消息协议，任一端改名需三处同步 */
export const MESSAGE_ACTION = {
  // content script / popup → service worker：读写学习卡片
  listCards: "listCards",
  findCard: "findCard",
  saveCard: "saveCard",
  deleteCard: "deleteCard",
  // content script / popup → service worker：读写设置（令牌、视图、抽屉宽度、额外站点）
  readSettings: "readSettings",
  writeSettings: "writeSettings",
  // popup → service worker：为用户新增的 GitLab 站点动态注册 content script
  registerOrigin: "registerOrigin",
  unregisterOrigin: "unregisterOrigin",
  // content script → service worker：打开设置页（鉴权失败时的出口）
  openSettings: "openSettings",
  // content script → service worker：这一页插件真的挂上了，把工具栏图标点亮
  pageActive: "pageActive",
  // 离开 MR 页时复位图标：Chrome 只在跨文档导航时清标签页级图标，SPA 导航不算
  pageInactive: "pageInactive",
};

/** 统一的调用口：service worker 回传的失败在这里还原成异常，调用点不必各写一遍 isOk 判断 */
export async function ask(action, payload = {}) {
  const reply = await chrome.runtime.sendMessage({ action, ...payload });
  if (!reply?.isOk) {
    throw new Error(reply?.error ?? "扩展后台没有响应");
  }
  return reply.result;
}
