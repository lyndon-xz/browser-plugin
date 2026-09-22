/**
 * 覆盖进度的通用存储：{ used, total, rounds }。
 * 手册片段与题库题目各自实例化一份，共用同一套读写与轮次推进逻辑。
 */

function store() {
  return chrome.storage.local;
}

export function createCoverageStore(storageKey) {
  async function load() {
    const result = await store().get(storageKey);
    const { used, total, rounds } = result?.[storageKey] ?? {};
    return {
      used: Array.isArray(used)
        ? [...new Set(used.filter((n) => Number.isInteger(n) && n >= 0))]
        : [],
      total: Number.isInteger(total) && total > 0 ? total : 0,
      rounds: Number.isInteger(rounds) && rounds > 0 ? rounds : 1,
    };
  }

  async function markUsed(usedIds, total) {
    if (!usedIds.length || total <= 0) {
      return load();
    }
    const current = await load();
    const next = {
      used: [...new Set([...current.used, ...usedIds])].sort((a, b) => a - b),
      total,
      rounds: current.rounds,
    };
    await store().set({ [storageKey]: next });
    return next;
  }

  /** 整轮考完后进入下一轮：清空已覆盖，轮次 +1 */
  async function startNewRound() {
    const { total, rounds } = await load();
    const next = { used: [], total, rounds: rounds + 1 };
    await store().set({ [storageKey]: next });
    return next;
  }

  /** 用户手动重置：清空已覆盖并回到第一轮，轮次不累加 */
  async function resetProgress() {
    const { total } = await load();
    const next = { used: [], total, rounds: 1 };
    await store().set({ [storageKey]: next });
    return next;
  }

  return { load, markUsed, startNewRound, resetProgress };
}
