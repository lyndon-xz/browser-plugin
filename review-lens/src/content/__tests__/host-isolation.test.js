import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import discussions from "../../core/__tests__/fixtures/discussions.json" with { type: "json" };
import { ENTRY_CLASS, init } from "../entry.js";
import { HOST_TAG } from "../../ui/drawer.js";

/*
 * 把 V-15「不污染宿主页」这条不变量固化成测试：宿主页是别人的页面，
 * 除了自己的按钮与一个宿主节点，什么都不该动。
 */
const ORIGIN = "https://git.dev.sh.ctripcorp.com";
const PATHNAME = "/hoteldynamicinfo/buyoutservice/-/merge_requests/27";

function discussionElement(discussionId) {
  const box = document.createElement("div");
  box.className = "discussion js-discussion-container";
  box.dataset.discussionId = discussionId;
  const actions = document.createElement("div");
  actions.className = "discussion-actions";
  box.append(actions);
  return box;
}

const fakeFetch = () =>
  vi.fn(async (url) => {
    if (url.includes("/discussions")) {
      return { ok: true, status: 200, json: async () => discussions, text: async () => "" };
    }
    if (url.includes("/repository/files/")) {
      return { ok: true, status: 200, json: async () => ({}), text: async () => "line\nline\n" };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ iid: 27, target_branch: "master", diff_refs: { head_sha: "head" } }),
      text: async () => "",
    };
  });

let teardown;
let nativeHistory;

beforeEach(() => {
  document.body.replaceChildren();
  const list = document.createElement("div");
  list.append(discussionElement("a56515dc2767b789c9c2ec99d90e6cdfc6f6e8d2"));
  document.body.append(list);
  nativeHistory = {
    push: window.history.pushState,
    replace: window.history.replaceState,
  };
});

afterEach(() => {
  teardown?.();
  teardown = undefined;
});

const start = () =>
  init({
    origin: ORIGIN,
    location: { pathname: PATHNAME, origin: ORIGIN },
    root: document.body,
    fetchImpl: fakeFetch(),
    loadStyleText: async () => "",
    readToken: async () => null,
    readSettings: async () => ({ view: "stacked" }),
    writeSettings: async () => {},
    saveCard: async () => ({ id: "c_1" }),
    findCard: async () => null,
  });

describe("host page isolation", () => {
  it("leaves the history API untouched", async () => {
    teardown = await start();

    expect(window.history.pushState).toBe(nativeHistory.push);
    expect(window.history.replaceState).toBe(nativeHistory.replace);
  });

  it("adds nothing to window", async () => {
    const before = new Set(Object.getOwnPropertyNames(window));

    teardown = await start();

    const added = Object.getOwnPropertyNames(window).filter((key) => !before.has(key));
    expect(added).toEqual([]);
  });

  it("adds exactly one node per thread, plus its own host node once opened", async () => {
    const list = document.body.firstElementChild;
    const beforeNodes = list.querySelectorAll("*").length;

    teardown = await start();

    expect(document.querySelectorAll(`.${ENTRY_CLASS}`)).toHaveLength(1);
    // 入口按钮自带品牌色条与文字两个子节点，所以是 3 个
    expect(list.querySelectorAll("*").length).toBe(beforeNodes + 3);
    expect(document.querySelectorAll(HOST_TAG)).toHaveLength(0);
  });

  it("takes its host node away again when torn down", async () => {
    const detach = await start();

    document.querySelector(`.${ENTRY_CLASS}`).click();
    await vi.waitFor(() => expect(document.querySelector(HOST_TAG)).not.toBeNull());

    detach();

    expect(document.querySelector(HOST_TAG)).toBeNull();
  });
});
