/** background、content script、popup 三方共享的消息协议，任一端改名需三处同步 */
export const MESSAGE_ACTION = {
  // content script → background：代理 DeepSeek 请求
  askAI: "askAI",
  // practice → background：从手册片段 AI 出题
  generateQuestions: "generateQuestions",
  // popup / background → content script：同步启用状态
  toggle: "toggle",
  // background → content script：对当前选区发起查询（快捷键）
  runQuery: "runQuery",
};

/** 统一的调用口：service worker 回传的失败在这里还原成异常，调用点不必各写一遍 isOk 判断 */
export async function ask(action, payload = {}) {
  const reply = await chrome.runtime.sendMessage({ action, ...payload });
  if (!reply?.isOk) {
    throw new Error(reply?.error ?? "扩展后台没有响应");
  }
  return reply.result;
}
