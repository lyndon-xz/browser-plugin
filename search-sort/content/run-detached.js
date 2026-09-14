/**
 * 同步回调里发起异步、失败只记一笔日志。用在拿不到调用方 catch 的出口：
 * 不把没人接的 Promise 交出去，也不在宿主页弹窗打扰用户。
 */
export function runDetached(label, task) {
  void (async () => {
    try {
      await task();
    } catch (error) {
      if (!chrome.runtime?.id) {
        return;
      }
      console.error(`[search-sort] ${label}：`, error);
    }
  })();
}
