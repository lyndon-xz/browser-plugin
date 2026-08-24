/*
 * chrome.storage.local 之上的一层：卡片与设置。
 * 传入 storage 而不是直接引用 chrome.*，是为了能在 jsdom 里测。
 */

const CARDS = "cards";
const SETTINGS = "settings";

const DEFAULT_SETTINGS = {
  // 令牌只在宿主页登录态不可用时才有值；存 local 不存 sync，免得同步到用户所有机器
  token: null,
  view: "stacked",
  drawerWidth: 820,
  extraOrigins: [],
};

// 同一条评审只该有一张卡片：同一个讨论再存一次是更新，不是新增
const sameThread = (a, b) =>
  a.origin === b.origin && a.project === b.project && a.mrIid === b.mrIid && a.discussionId === b.discussionId;

export function createStore(storage) {
  async function listCards() {
    const stored = await storage.get([CARDS]);
    return stored[CARDS] ?? [];
  }

  async function findCard(source) {
    const cards = await listCards();
    return cards.find((card) => sameThread(card.source, source)) ?? null;
  }

  async function saveCard(card) {
    const cards = await listCards();
    const existing = cards.find((item) => sameThread(item.source, card.source));
    const saved = {
      ...card,
      id: existing?.id ?? `c_${Date.now()}_${card.source.discussionId.slice(0, 8)}`,
      savedAt: new Date().toISOString(),
    };

    const next = existing ? cards.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...cards];
    // 让存储失败冒出去：静默丢卡片等于用户以为存下了、其实没有
    await storage.set({ [CARDS]: next });
    return saved;
  }

  async function deleteCard(id) {
    const cards = await listCards();
    await storage.set({ [CARDS]: cards.filter((card) => card.id !== id) });
  }

  async function readSettings() {
    const stored = await storage.get([SETTINGS]);
    return { ...DEFAULT_SETTINGS, ...(stored[SETTINGS] ?? {}) };
  }

  async function writeSettings(patch) {
    const current = await readSettings();
    await storage.set({ [SETTINGS]: { ...current, ...patch } });
  }

  return { listCards, findCard, saveCard, deleteCard, readSettings, writeSettings };
}
