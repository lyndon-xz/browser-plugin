import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDrawer, HOST_TAG } from "../drawer.js";

const thread = {
  discussionId: "1d3bb93a",
  author: "cp.tang",
  createdAt: "2026-05-19T10:00:00.000+08:00",
  body: "超时配置180s，太长了",
  path: "a/Dao.java",
  anchorLine: 32,
  outdated: true,
  replies: [{ author: "xiunn", createdAt: "2026-05-19T11:00:00.000+08:00", body: "改成30" }],
};

const snapshot = (text, sha) => ({
  sha,
  path: thread.path,
  anchorLine: 32,
  rangeStart: 32,
  rangeEnd: 32,
  lines: [{ number: 32, text }],
});

const state = {
  status: "ready",
  thread,
  then: snapshot("timeout(60 * 3);", "55c3bb54"),
  now: snapshot("timeout(30);", "1aba8de0"),
  diffOps: [],
};

let drawer;
let onSaveCard;

beforeEach(() => {
  document.body.replaceChildren();
  onSaveCard = vi.fn(async () => ({ id: "c_1" }));
  drawer = createDrawer({ styleText: "", onSaveCard });
});

afterEach(() => {
  drawer.close();
});

const shadow = () => document.body.querySelector(HOST_TAG).shadowRoot;
const saveButton = () => shadow().querySelector(".btn-save");

describe("saving a card", () => {
  it("hands over everything the card needs, including my note", async () => {
    drawer.render(state);
    shadow().querySelector(".note-input").value = "DAL 超时按最慢的正常请求给";

    saveButton().click();
    await vi.waitFor(() => expect(onSaveCard).toHaveBeenCalled());

    const [card] = onSaveCard.mock.calls[0];
    expect(card).toMatchObject({
      symbol: "a/Dao.java:32",
      thenCode: "timeout(60 * 3);",
      nowCode: "timeout(30);",
      note: "DAL 超时按最慢的正常请求给",
    });
    expect(card.comment).toMatchObject({ author: "cp.tang", body: thread.body });
    expect(card.replies).toHaveLength(1);
  });

  it("passes null as the fixed code when the place was never changed", async () => {
    drawer.render({ ...state, now: null, commits: [] });

    saveButton().click();
    await vi.waitFor(() => expect(onSaveCard).toHaveBeenCalled());

    expect(onSaveCard.mock.calls[0][0].nowCode).toBeNull();
  });

  it("saves once even when the button is clicked twice", async () => {
    drawer.render(state);

    saveButton().click();
    saveButton().click();
    await vi.waitFor(() => expect(saveButton().textContent).toContain("已存"));

    expect(onSaveCard).toHaveBeenCalledTimes(1);
  });

  it("shows an already-saved thread as saved from the start", () => {
    drawer.render({ ...state, savedCardId: "c_1" });

    expect(saveButton().textContent).toContain("已存");
  });

  it("says so when saving fails, instead of pretending it worked", async () => {
    onSaveCard.mockRejectedValueOnce(new Error("quota exceeded"));
    drawer.render(state);

    saveButton().click();
    await vi.waitFor(() => expect(saveButton().textContent).toContain("存储失败"));
  });
});
