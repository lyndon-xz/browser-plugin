// background、content script、popup 三方共享的消息协议，任一端改名需三处同步
const MESSAGE_ACTION = {
  // content script → background：页面内软跳转导致 URL 变化
  urlChanged: "urlChanged",
  // background → content script：把重排后的 URL 原地替换上去
  apply: "apply",
  // popup → background：配置已保存，据此刷新图标
  configUpdated: "configUpdated",
};
