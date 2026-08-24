import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "../store.js";

/*
 * 用假的 chrome.storage.local 驱动：真实实现由 service worker 转发，
 * 这里要固定的是「读写什么形状、失败怎么办、重复存会不会长出两条」。
 */
function fakeStorage(initial = {}) {
  let data = structuredClone(initial);
  return {
    data: () => data,
    get: vi.fn(async (keys) => {
      const wanted = Array.isArray(keys) ? keys : Object.keys(keys ?? {});
      return Object.fromEntries(wanted.filter((key) => key in data).map((key) => [key, data[key]]));
    }),
    set: vi.fn(async (patch) => {
      data = { ...data, ...structuredClone(patch) };
    }),
  };
}

const card = {
  source: {
    origin: "https://git.dev.sh.ctripcorp.com",
    project: "hoteldynamicinfo/buyoutservice",
    mrIid: 27,
    discussionId: "1d3bb93a",
    path: "a/Dao.java",
    line: 32,
    webUrl: "https://git.dev.sh.ctripcorp.com/…/-/merge_requests/27#note_1",
  },
  symbol: "getBankGuaranteeDetailByContractIds()",
  comment: { author: "cp.tang", createdAt: "2026-05-19T10:00:00.000+08:00", body: "超时配置180s，太长了" },
  thenCode: "timeout(60 * 3)",
  nowCode: "timeout(30)",
  note: "DAL 超时按最慢的正常请求给，不是按最坏情况给",
};

let storage;
let store;

beforeEach(() => {
  storage = fakeStorage();
  store = createStore(storage);
});

describe("cards", () => {
  it("reads back what it saved", async () => {
    const saved = await store.saveCard(card);

    expect(saved.id).toBeTruthy();
    expect(await store.listCards()).toHaveLength(1);
  });

  it("keeps null as null, so 「至今未改动」 does not become an empty string", async () => {
    await store.saveCard({ ...card, nowCode: null });

    const [stored] = await store.listCards();
    expect(stored.nowCode).toBeNull();
  });

  it("updates the existing card when the same thread is saved twice", async () => {
    await store.saveCard(card);
    await store.saveCard({ ...card, note: "改过的笔记" });

    const cards = await store.listCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].note).toBe("改过的笔记");
  });

  it("tells the caller whether a thread is already saved", async () => {
    expect(await store.findCard(card.source)).toBeNull();

    await store.saveCard(card);

    expect(await store.findCard(card.source)).not.toBeNull();
  });

  it("deletes by id", async () => {
    const saved = await store.saveCard(card);

    await store.deleteCard(saved.id);

    expect(await store.listCards()).toEqual([]);
  });

  it("surfaces a storage failure instead of losing the card quietly", async () => {
    storage.set.mockRejectedValueOnce(new Error("QUOTA_BYTES quota exceeded"));

    await expect(store.saveCard(card)).rejects.toThrow(/quota/i);
  });

  it("starts from an empty list on a fresh install", async () => {
    expect(await store.listCards()).toEqual([]);
  });
});

describe("settings", () => {
  it("defaults to the stacked view and no token", async () => {
    expect(await store.readSettings()).toMatchObject({ view: "stacked", token: null });
  });

  it("writes only the keys it was given", async () => {
    await store.writeSettings({ view: "side" });

    expect(await store.readSettings()).toMatchObject({ view: "side", token: null });
  });

  it("keeps the token out of the card export path by storing it separately", async () => {
    await store.writeSettings({ token: "glpat-secret" });

    expect(JSON.stringify(await store.listCards())).not.toContain("glpat-secret");
  });
});
