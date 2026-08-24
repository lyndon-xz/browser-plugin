import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_WIDTH, MIN_WIDTH, createDrawer, HOST_TAG } from "../drawer.js";

const thread = {
  author: "cp.tang",
  createdAt: "2026-05-07T10:00:00.000+08:00",
  body: "NIT：这些字段建议定义常量类维护",
  path: "a/QueryFinanceInfoService.java",
  anchorLine: 151,
  outdated: true,
  replies: [],
};

const snapshot = {
  sha: "abc",
  path: thread.path,
  anchorLine: 151,
  rangeStart: 150,
  rangeEnd: 152,
  lines: [
    { number: 150, text: "if (request.getCountryName() != null) {" },
    { number: 151, text: "  list.add(buildParamEntity(\"country\", …));" },
    { number: 152, text: "}" },
  ],
};

const state = {
  status: "ready",
  thread,
  then: snapshot,
  now: null,
  diffOps: [],
};

let drawer;
let stored;

beforeEach(() => {
  document.body.replaceChildren();
  stored = {};
  drawer = createDrawer({
    styleText: "",
    readWidth: () => stored.width ?? null,
    writeWidth: (width) => {
      stored.width = width;
    },
  });
});

afterEach(() => {
  drawer.close();
});

const shadow = () => document.body.querySelector(HOST_TAG).shadowRoot;
const panel = () => shadow().querySelector(".drawer");
const grip = () => shadow().querySelector(".drawer-grip");

function drag(fromX, toX) {
  grip().dispatchEvent(new MouseEvent("mousedown", { clientX: fromX, bubbles: true, composed: true }));
  document.dispatchEvent(new MouseEvent("mousemove", { clientX: toX, bubbles: true }));
  document.dispatchEvent(new MouseEvent("mouseup", { clientX: toX, bubbles: true }));
}

describe("resizing the drawer", () => {
  it("offers a grip on the edge the user would reach for", () => {
    drawer.render(state);

    expect(grip()).not.toBeNull();
  });

  it("widens as the grip is dragged left", () => {
    drawer.render(state);
    const before = Number.parseInt(panel().style.width, 10);

    drag(900, 700);

    expect(Number.parseInt(panel().style.width, 10)).toBe(before + 200);
  });

  it("remembers the width once the drag ends", () => {
    drawer.render(state);

    drag(900, 700);

    expect(stored.width).toBe(Number.parseInt(panel().style.width, 10));
  });

  it("refuses to become a sliver or to swallow the whole page", () => {
    drawer.render(state);

    drag(900, 3000);
    expect(Number.parseInt(panel().style.width, 10)).toBe(MIN_WIDTH);

    drag(900, -3000);
    expect(Number.parseInt(panel().style.width, 10)).toBe(MAX_WIDTH);
  });

  it("opens at the width it was left at", () => {
    stored.width = 1100;
    const reopened = createDrawer({ styleText: "", readWidth: () => stored.width });

    reopened.render(state);

    expect(reopened !== drawer).toBe(true);
    expect(Number.parseInt(document.body.querySelector(HOST_TAG).shadowRoot.querySelector(".drawer").style.width, 10)).toBe(1100);
    reopened.close();
  });

  it("does not write a width when nothing was dragged", () => {
    drawer.render(state);

    expect(stored.width).toBeUndefined();
  });
});
