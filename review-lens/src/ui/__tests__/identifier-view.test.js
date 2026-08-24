import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDrawer, HOST_TAG } from "../drawer.js";

const thread = {
  author: "cp.tang",
  createdAt: "2026-05-19T10:00:00.000+08:00",
  body: "用 ReTryService.doIoService 时 responseEntity.getResponse() 是空值",
  path: "a/Dao.java",
  anchorLine: 38,
  outdated: true,
  replies: [],
};

const then = {
  sha: "55c3bb54",
  path: thread.path,
  anchorLine: 38,
  rangeStart: 37,
  rangeEnd: 41,
  lines: [
    { number: 37, text: "    ResponseEntity<Type> responseEntity =" },
    { number: 38, text: "        ReTryService.doIoService(Exception.class, ctx -> {" },
    { number: 39, text: "          return soaClient.get(request);" },
    { number: 40, text: "        });" },
    { number: 41, text: "    return responseEntity.getResponse().getList();" },
  ],
};

const state = {
  status: "ready",
  thread,
  then,
  now: null,
  diffOps: [],
};

let drawer;
let expandRequests;

beforeEach(() => {
  document.body.replaceChildren();
  expandRequests = [];
  drawer = createDrawer({
    styleText: "",
    onWiden: (...args) => expandRequests.push(args),
  });
});

afterEach(() => {
  drawer.close();
});

const shadow = () => document.body.querySelector(HOST_TAG).shadowRoot;
const chips = () => [...shadow().querySelectorAll(".ident")];
const lineAt = (number) => shadow().querySelector(`.code-line[data-line="${number}"]`);

describe("identifier links", () => {
  it("turns the identifiers named in the comment into clickable chips", () => {
    drawer.render(state);

    expect(chips().map((chip) => chip.textContent)).toEqual([
      "ReTryService.doIoService",
      "responseEntity.getResponse()",
    ]);
  });

  it("leaves the rest of the comment text intact and in order", () => {
    drawer.render(state);

    expect(shadow().querySelector(".comment-card p").textContent).toBe(thread.body);
  });

  it("marks where an identifier shows up in the code", () => {
    drawer.render(state);

    expect(lineAt(38).querySelector(".hit")).not.toBeNull();
    expect(lineAt(39).querySelector(".hit")).toBeNull();
  });

  it("does not offer a dead link for an identifier the code never mentions", () => {
    drawer.render({
      ...state,
      thread: { ...thread, body: "NullPointerException 时会怎样" },
    });

    expect(chips()).toHaveLength(0);
  });

  it("scrolls to the identifier's line when its chip is clicked", () => {
    drawer.render(state);
    const scrolled = vi.fn();
    lineAt(41).scrollIntoView = scrolled;

    chips()[1].click();

    expect(scrolled).toHaveBeenCalled();
    expect(lineAt(41).classList.contains("flash")).toBe(true);
  });
});

describe("related lines", () => {
  it("counts the candidates on the button", () => {
    drawer.render(state);

    expect(shadow().querySelector(".btn-related").textContent).toContain("2");
  });

  it("lists each candidate with the reason it is a candidate", () => {
    drawer.render(state);

    shadow().querySelector(".btn-related").click();
    const items = [...shadow().querySelectorAll(".related-item")];

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.textContent).join(" ")).toContain("评论锚定");
    expect(items.map((item) => item.textContent).join(" ")).toContain("responseEntity.getResponse()");
  });

  it("pops up right next to the button that opened it", () => {
    drawer.render(state);
    const button = shadow().querySelector(".btn-related");

    button.click();
    const pop = shadow().querySelector(".related-pop");

    // 结构上就贴着按钮：父节点是专门包住这个按钮的定位容器，浮层不会跑到另一头去（DD-37）
    expect(pop.parentElement.className).toContain("related-anchor");
    expect(pop.parentElement.querySelector(".btn-related")).toBe(button);
  });

  it("closes when the button is clicked again", () => {
    drawer.render(state);

    shadow().querySelector(".btn-related").click();
    shadow().querySelector(".btn-related").click();

    expect(shadow().querySelector(".related-pop")).toBeNull();
  });

  it("hides the button when the anchor is the only candidate", () => {
    drawer.render({ ...state, thread: { ...thread, body: "超时太长了" } });

    expect(shadow().querySelector(".btn-related")).toBeNull();
  });
});

describe("widening the view", () => {
  it("only ever asks for more, never less", () => {
    drawer.render(state);

    shadow().querySelector(".btn-widen").click();

    // 单调：点一次就是「再多 10 行」，不存在"展开反而更少"（DD-35）
    expect(expandRequests).toEqual([[10]]);
  });

  it("keeps adding on each click", () => {
    drawer.render({ ...state, extraLines: 10 });

    shadow().querySelector(".btn-widen").click();

    expect(expandRequests).toEqual([[20]]);
  });

  it("offers a way back only once the view was widened", () => {
    drawer.render(state);
    expect(shadow().querySelector(".btn-reset")).toBeNull();

    drawer.render({ ...state, extraLines: 10 });
    expect(shadow().querySelector(".btn-reset")).not.toBeNull();
  });

  it("resets to the method it started from", () => {
    drawer.render({ ...state, extraLines: 20 });

    shadow().querySelector(".btn-reset").click();

    expect(expandRequests).toEqual([[0]]);
  });
});
