// chrome.storage.local 之上的一层：卡片与设置。传入 storage 而不是引用 chrome.*，便于替换实现

const CARDS = "cards";
const SETTINGS = "settings";

const DEFAULT_SETTINGS = {
  /*
   * 按站点分开存：令牌只该发给它被授予的那个来源，跟着当前页面走会把它发往另一个已注册站点。
   * 存 local 不存 sync，免得同步到用户所有机器。
   */
  tokens: {},
  // null 表示「用户没切过」，默认视图由抽屉定义——同一个值不在两处各写一遍
  view: null,
  // null 表示「用户没调过」，默认宽度由抽屉自己定义——同一个值不在两处各写一遍
  drawerWidth: null,
  syncScroll: true,
  extraOrigins: [],
};

// 同一条评审只该有一张卡片：同一个讨论再存一次是更新，不是新增
const sameThread = (a, b) =>
  a.origin === b.origin &&
  a.project === b.project &&
  a.mrIid === b.mrIid &&
  a.discussionId === b.discussionId;

export function createStore(storage) {
  // 只等它结束、不关心成败：队列不能被一次失败掐断，失败由发起那次写入的调用方接管
  const settled = async (promise) => {
    try {
      await promise;
    } catch {
      return;
    }
  };

  /*
   * 写入一律排队：每个写操作都是「读全表 → 改 → 整表写回」，中间有 await 让出。
   * 两个标签页同时存卡、或抽屉写视图与设置页写令牌撞上，后写的会基于旧快照
   * 整体覆盖，前一次静默消失。连点两次「存下来」就足以触发。
   */
  let tail = Promise.resolve();
  const serial = (task) => {
    const run = (async () => {
      await settled(tail);
      return task();
    })();
    tail = settled(run);
    return run;
  };

  async function listCards() {
    const stored = await storage.get([CARDS]);
    return stored[CARDS] ?? [];
  }

  async function findCard(source) {
    const cards = await listCards();
    return cards.find((card) => sameThread(card.source, source)) ?? null;
  }

  async function saveCardNow(card) {
    const cards = await listCards();
    const existing = cards.find((item) => sameThread(item.source, card.source));
    const saved = {
      ...card,
      id:
        existing?.id ??
        `c_${Date.now()}_${card.source.discussionId.slice(0, 8)}`,
      savedAt: new Date().toISOString(),
    };

    const next = existing
      ? cards.map((item) => (item.id === saved.id ? saved : item))
      : [saved, ...cards];
    // 让存储失败冒出去：静默丢卡片等于用户以为存下了、其实没有
    await storage.set({ [CARDS]: next });
    return saved;
  }

  async function deleteCardNow(id) {
    const cards = await listCards();
    await storage.set({ [CARDS]: cards.filter((card) => card.id !== id) });
  }

  /*
   * 没有站点归属的旧令牌不能猜归给谁——猜错就把令牌发往另一个站点，正是按站点隔离要防的事。
   * 所以去掉旧键并留一个待办标记，由设置页请用户按站点重填。
   */
  function migrate(settings) {
    if (typeof settings.token !== "string") return settings;

    const { token, ...rest } = settings;
    return { ...rest, needsTokenReentry: true };
  }

  async function readSettings() {
    const stored = await storage.get([SETTINGS]);
    return migrate({ ...DEFAULT_SETTINGS, ...(stored[SETTINGS] ?? {}) });
  }

  // 返回合并后的完整设置：设置页拿它当新的内存状态，不返回就会把 settings 置成 undefined
  async function writeSettingsNow(patch) {
    const next = { ...(await readSettings()), ...patch };
    await storage.set({ [SETTINGS]: next });
    return next;
  }

  return {
    listCards,
    findCard,
    readSettings,
    // 三个写入口全部走队列
    saveCard: (card) => serial(() => saveCardNow(card)),
    deleteCard: (id) => serial(() => deleteCardNow(id)),
    writeSettings: (patch) => serial(() => writeSettingsNow(patch)),
  };
}
