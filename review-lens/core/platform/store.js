import { tokensByHost } from "./origins.js";

// chrome.storage.local 之上的一层：卡片与设置。传入 storage 而不是引用 chrome.*，便于替换实现

const CARDS = "cards";
const SETTINGS = "settings";

const DEFAULT_SETTINGS = {
  /*
   * 按 hostname 存令牌：同一 GitLab 的 http/https 共用一条，跟着当前页 origin 取对应 host 的令牌。
   * 存 local 不存 sync，免得同步到用户所有机器。
   */
  tokens: {},
  // null 表示「用户没切过」，默认视图由抽屉定义——同一个值不在两处各写一遍
  view: null,
  // null 表示「用户没调过」，默认宽度由抽屉自己定义——同一个值不在两处各写一遍
  drawerWidthPx: null,
  // null 表示「用户没改过」，默认同步由抽屉自己定义
  isSyncScroll: null,
  extraOrigins: [],
  shouldReenterToken: false,
};

// 同一条评审只该有一张卡片：同一个讨论再存一次是更新，不是新增
const sameThread = (a, b) =>
  a.origin === b.origin &&
  a.project === b.project &&
  a.mrIid === b.mrIid &&
  a.discussionId === b.discussionId;

/*
 * 内存字段与旧存储键在边界映射：已装用户的数据不能因改名丢掉。
 * 写出时新旧键一起落盘，读入时新键优先、没有再读旧键。
 */
function fromStored(raw) {
  const source = raw ?? {};
  const next = { ...source };

  if (typeof next.token === "string") {
    delete next.token;
    next.shouldReenterToken = true;
  }

  return {
    tokens: tokensByHost(next.tokens),
    view: next.view ?? null,
    drawerWidthPx: next.drawerWidthPx ?? next.drawerWidth ?? null,
    isSyncScroll: next.isSyncScroll ?? next.syncScroll ?? null,
    extraOrigins: next.extraOrigins ?? [],
    shouldReenterToken: Boolean(
      next.shouldReenterToken ?? next.needsTokenReentry,
    ),
  };
}

function toStored(settings) {
  return {
    tokens: settings.tokens,
    view: settings.view,
    drawerWidthPx: settings.drawerWidthPx,
    drawerWidth: settings.drawerWidthPx,
    isSyncScroll: settings.isSyncScroll,
    syncScroll: settings.isSyncScroll,
    extraOrigins: settings.extraOrigins,
    shouldReenterToken: settings.shouldReenterToken,
    needsTokenReentry: settings.shouldReenterToken,
  };
}

/*
 * 标量字段浅合并；tokens / extraOrigins 由调用方传完整快照（删站点、清令牌都要落盘）。
 * 队列串行写已经避免同 SW 内丢增量，这里再 union 会把删掉的 origin 或 token 键加回来。
 */
function mergeSettings(current, patch) {
  const next = { ...current, ...patch };

  if (patch.tokens) {
    next.tokens = { ...patch.tokens };
  }
  if (patch.extraOrigins) {
    next.extraOrigins = [...patch.extraOrigins];
  }
  return next;
}

/** chrome.storage 之上的卡片与设置存储；写入串行避免互相覆盖 */
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
    // 写入前再读、写后校验：同 SW 内靠队列，跨 tab / SW 重启靠短重试合并
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const fresh = await listCards();
      const existing = fresh.find((item) =>
        sameThread(item.source, card.source),
      );
      const saved = {
        ...card,
        id:
          existing?.id ??
          `c_${Date.now()}_${card.source.discussionId.slice(0, 8)}`,
        savedAt: new Date().toISOString(),
      };
      const rest = fresh.filter(
        (item) => !sameThread(item.source, card.source),
      );
      await storage.set({ [CARDS]: [saved, ...rest] });

      const verify = await findCard(card.source);
      if (verify?.savedAt === saved.savedAt) {
        return saved;
      }
    }
    throw new Error("存储冲突，请再试一次");
  }

  async function deleteCardNow(id) {
    const fresh = await listCards();
    await storage.set({ [CARDS]: fresh.filter((card) => card.id !== id) });
  }

  async function readSettings() {
    const stored = await storage.get([SETTINGS]);
    return fromStored({ ...DEFAULT_SETTINGS, ...(stored[SETTINGS] ?? {}) });
  }

  // 返回合并后的完整设置：设置页拿它当新的内存状态，不返回就会把 settings 置成 undefined
  async function writeSettingsNow(patch) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = await readSettings();
      const next = mergeSettings(current, patch);
      await storage.set({ [SETTINGS]: toStored(next) });
      const verify = await readSettings();
      const patchKeys = Object.keys(patch);
      const merged = patchKeys.every((key) => {
        const left = verify[key];
        const right = next[key];
        if (key === "tokens" || key === "extraOrigins") {
          return JSON.stringify(left) === JSON.stringify(right);
        }
        return left === right;
      });
      if (merged) {
        return next;
      }
    }
    throw new Error("设置没能保存，请再试一次");
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
