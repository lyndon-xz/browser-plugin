/**
 * 同步回调里发起异步、失败只记一笔日志。用在抽屉回调与卸载这类拿不到出口的地方：
 * 不把没人接的 Promise 交出去，也不为一份界面偏好打扰正在读评审的人。
 * 真正的用户数据（卡片）不走这里，它有界面反馈。
 */
export function runDetached(label, task) {
  void (async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[review-lens] ${label}：`, error);
    }
  })();
}
