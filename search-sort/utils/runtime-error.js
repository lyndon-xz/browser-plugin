/*
 * Chrome 这两类失败只给文案、不给错误码，判定只能匹配 message。
 * background / popup / content 三端都要判同一件事，收敛在这里，改文案只改一处
 */

const messageOf = (error) => error?.message ?? String(error);

/** 标签页已关闭：对它的 tabs.* 调用注定失败，属预期情形 */
export function isTabGoneError(error) {
  return /No tab with id/i.test(messageOf(error));
}

/** 扩展被重新加载或更新，页面上的 content script 已成孤儿 */
export function isOrphanedError(error) {
  return /Extension context invalidated|message port closed/i.test(
    messageOf(error),
  );
}
