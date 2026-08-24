import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDrawer, HOST_TAG } from "../drawer.js";

const thread = {
  author: "cp.tang",
  createdAt: "2026-05-19T10:00:00.000+08:00",
  body: "超时配置180s，太长了",
  path: "buyoutservice-dao/src/main/java/BankGuaranteeBuyoutContractDetailDao.java",
  anchorLine: 32,
  outdated: true,
  replies: [{ author: "xiunn", createdAt: "2026-05-19T11:00:00.000+08:00", body: "改成30" }],
};

const snapshot = (lines, sha) => ({
  sha,
  path: thread.path,
  anchorLine: 32,
  rangeStart: 31,
  rangeEnd: 33,
  lines: lines.map((text, index) => ({ number: 31 + index, text })),
});

const then = snapshot(["String sql = ...;", "  timeout(60 * 3);", "return dao.query(...);"], "55c3bb54");
const now = snapshot(["String sql = ...;", "  timeout(30);", "return dao.query(...);"], "1aba8de0");

const comparedState = {
  status: "ready",
  thread,
  then,
  now,
  // diffOps 带文件绝对行号（compare.js 换算好），渲染时按行号直接对号（DD-42）
  diffOps: [
    { type: "keep", text: "String sql = ...;", thenLine: 31, nowLine: 31 },
    { type: "remove", text: "  timeout(60 * 3);", thenLine: 32, nowLine: null },
    { type: "add", text: "  timeout(30);", thenLine: null, nowLine: 32 },
    { type: "keep", text: "return dao.query(...);", thenLine: 33, nowLine: 33 },
  ],
};

let drawer;
let saved;

beforeEach(() => {
  document.body.replaceChildren();
  saved = {};
  drawer = createDrawer({
    styleText: "",
    readView: () => saved.view ?? null,
    writeView: (view) => {
      saved.view = view;
    },
    readSyncScroll: () => saved.syncScroll ?? null,
    writeSyncScroll: (on) => {
      saved.syncScroll = on;
    },
  });
});

afterEach(() => {
  drawer.close();
});

const shadow = () => document.body.querySelector(HOST_TAG).shadowRoot;
const panes = () => [...shadow().querySelectorAll(".pane")];
const linesIn = (pane) => [...pane.querySelectorAll(".code-line")];

describe("compare view", () => {
  it("renders both versions, labelled by who and when", () => {
    drawer.render(comparedState);

    expect(panes()).toHaveLength(2);
    expect(panes()[0].className).toContain("then");
    expect(panes()[1].className).toContain("now");
    expect(shadow().textContent).toContain("评论时");
    expect(shadow().textContent).toContain("修正后");
  });

  it("leaves the author and date to the comment card, not the spine", () => {
    drawer.render(comparedState);

    // 作者与日期在评论卡里已经有了，时间脊只留视图切换（DD-24）
    expect(shadow().querySelector(".spine").textContent).not.toContain("cp.tang");
    expect(shadow().querySelector(".spine").textContent).not.toContain("2026-05-19");
  });

  it("colours only the lines that actually changed", () => {
    drawer.render(comparedState);
    const kept = [...panes()[0].querySelectorAll(".code-line")].filter(
      (line) => !line.classList.contains("removed") && !line.classList.contains("added"),
    );

    // 整块底色会把行级 diff 盖掉，所以未改动的行必须干净（DD-22）
    expect(kept.length).toBeGreaterThan(0);
    for (const line of kept) {
      expect(line.className).not.toMatch(/added|removed/);
    }
  });

  it("never repeats the branch label the pane header already carries", () => {
    drawer.render(comparedState);
    expect(shadow().textContent).not.toContain("当前分支");

    shadow().querySelector('[data-view="side"]').click();
    // 并排也一样：pane 头部的「修正后」已经说明了这一侧是什么（DD-38）
    expect(shadow().textContent).not.toContain("当前分支");
  });

  it("stacks the two versions by default, because side by side wraps long Java lines", () => {
    drawer.render(comparedState);

    expect(shadow().querySelector(".panes").className).toContain("stacked");
  });

  it("switches to side by side and remembers the choice", () => {
    drawer.render(comparedState);

    shadow().querySelector('[data-view="side"]').click();

    expect(shadow().querySelector(".panes").className).not.toContain("stacked");
    expect(saved.view).toBe("side");
  });

  it("marks removed lines on the old side and added lines on the new side", () => {
    drawer.render(comparedState);
    const [thenPane, nowPane] = panes();

    expect(linesIn(thenPane).filter((line) => line.classList.contains("removed"))).toHaveLength(1);
    expect(linesIn(thenPane).filter((line) => line.classList.contains("added"))).toHaveLength(0);
    expect(linesIn(nowPane).filter((line) => line.classList.contains("added"))).toHaveLength(1);
    expect(linesIn(nowPane).filter((line) => line.classList.contains("removed"))).toHaveLength(0);
  });

  it("keeps the colouring stable when the view is widened", () => {
    // 基准是方法体，扩出来的上下文行永不标记（DD-42）
    const widened = {
      ...comparedState,
      then: {
        ...then,
        rangeStart: 30,
        rangeEnd: 34,
        lines: [
          { number: 30, text: "void run() {" },
          ...then.lines,
          { number: 34, text: "}" },
        ],
      },
    };
    drawer.render(widened);

    const marked = linesIn(panes()[0]).filter((line) => line.classList.contains("removed"));
    expect(marked.map((line) => line.dataset.line)).toEqual(["32"]);
  });

  it("keeps the anchor mark on its own channel, so a diff line can carry both", () => {
    drawer.render(comparedState);
    const anchored = linesIn(panes()[0]).find((line) => line.dataset.line === "32");

    expect(anchored.classList.contains("anchor")).toBe(true);
    expect(anchored.classList.contains("removed")).toBe(true);
  });

  it("mirrors scrolling in both layouts, so the two sides stay on the same code", () => {
    // 同步的意义是让两侧停在对应的那段代码上，上下布局同样成立（DD-39）
    for (const layout of ["stacked", "side"]) {
      drawer.close();
      drawer.render(comparedState);
      if (layout === "side") shadow().querySelector('[data-view="side"]').click();

      const [thenCode, nowCode] = shadow().querySelectorAll(".code");
      thenCode.scrollTop = 120;
      thenCode.dispatchEvent(new Event("scroll"));

      expect(nowCode.scrollTop).toBe(120);
    }
  });

  it("lets the reader turn the mirroring off, and remembers it", () => {
    drawer.render(comparedState);
    shadow().querySelector('[data-view="side"]').click();

    shadow().querySelector(".sync-toggle input").click();

    const [thenCode, nowCode] = shadow().querySelectorAll(".code");
    thenCode.scrollTop = 120;
    thenCode.dispatchEvent(new Event("scroll"));

    expect(nowCode.scrollTop).toBe(0);
    expect(saved.syncScroll).toBe(false);
  });

  /*
   * 读者已经滚到要看的那一段了，切个开关不该把位置清回开头（DD-47）。
   */
  it("keeps the reader where they were when the mirroring is switched", () => {
    drawer.render(comparedState);

    const [thenCode] = shadow().querySelectorAll(".code");
    thenCode.scrollTop = 140;

    shadow().querySelector(".sync-toggle input").click();

    const [afterToggle] = shadow().querySelectorAll(".code");
    // 同一个节点：这个开关不改布局，重绘纯属浪费，而重绘就会归零
    expect(afterToggle).toBe(thenCode);
    expect(afterToggle.scrollTop).toBe(140);
  });

  it("starts mirroring again when the switch goes back on", () => {
    drawer.render(comparedState);
    const box = shadow().querySelector(".sync-toggle input");

    box.click();
    box.click();

    const [thenCode, nowCode] = shadow().querySelectorAll(".code");
    thenCode.scrollTop = 90;
    thenCode.dispatchEvent(new Event("scroll"));

    expect(nowCode.scrollTop).toBe(90);
  });

  it("keeps the reader near the same code when the layout changes", () => {
    drawer.render(comparedState);

    const [thenCode] = shadow().querySelectorAll(".code");
    thenCode.scrollTop = 140;

    shadow().querySelector('[data-view="side"]').click();

    // 换布局必须重排，但位置要还原——不该跳回开头
    expect(shadow().querySelectorAll(".code")[0].scrollTop).toBe(140);
  });

  it("does nothing when the layout already in use is clicked", () => {
    drawer.render(comparedState);

    const [thenCode] = shadow().querySelectorAll(".code");
    shadow().querySelector('[data-view="stacked"]').click();

    expect(shadow().querySelectorAll(".code")[0]).toBe(thenCode);
  });

  /*
   * 逐行相同时右侧再摆一份一模一样的代码，只是把同一段抄了第二遍（DD-48）。
   */
  it("does not put an identical copy of the code on the right", () => {
    drawer.render({ ...comparedState, state: "unchanged", now: null, commits: [], diffOps: [] });

    expect(shadow().querySelectorAll(".code")).toHaveLength(1);
    // 锁的是「右侧给一句结论而不是代码」，不锁具体措辞
    expect(shadow().querySelector(".untouched").textContent).toMatch(/没有改动|未改动/);
  });

  it("keeps offering both layouts even when the right-hand block is a conclusion", () => {
    for (const state of ["unchanged", "unlocatable"]) {
      drawer.close();
      drawer.render({ ...comparedState, state, now: null, commits: [], diffOps: [] });

      // 排的是「两个块」，右边那个是代码还是结论都一样（DD-50）
      expect(shadow().querySelector(".view-switch")).not.toBeNull();
      // 只有一个可滚动的代码区，同步滚动无从施力
      expect(shadow().querySelector(".sync-toggle")).toBeNull();
      expect(shadow().querySelector(".spine-note")).not.toBeNull();
      // 结论块与代码同在 panes 里，所以切换对它一样生效
      expect(shadow().querySelector(".untouched").closest(".panes")).not.toBeNull();
    }
  });

  it("words the conclusion without pointing left or up, because the layout can change", () => {
    drawer.render({ ...comparedState, state: "unchanged", now: null, commits: [], diffOps: [] });

    expect(shadow().querySelector(".untouched").textContent).not.toMatch(/左边|右边|上面|下面/);
  });

  it("offers the mirroring switch in both layouts", () => {
    drawer.render(comparedState);
    expect(shadow().querySelector(".sync-toggle")).not.toBeNull();

    shadow().querySelector('[data-view="side"]').click();
    expect(shadow().querySelector(".sync-toggle")).not.toBeNull();
  });

  it("shows the unchanged notice instead of a fabricated diff", () => {
    drawer.render({
      status: "ready",
      thread: { ...thread, outdated: false },
      then,
      now: null,
      commits: Array.from({ length: 12 }, (_, index) => ({ id: `c${index}` })),
      diffOps: [],
    });

    const notice = shadow().querySelector(".untouched").textContent;

    expect(notice).toContain("12");
    /*
     * 那个查询带 path 过滤，返回的就是动过这个文件的提交；说成「都没碰过这个文件」
     * 与查询语义正好相反（DD-49）。
     */
    expect(notice).not.toContain("没有碰过这个文件");
    expect(notice).toContain("没有动到这段代码");
    expect(shadow().querySelectorAll(".code-line.added")).toHaveLength(0);
  });

  it("words the unchanged notice differently when the file never moved", () => {
    drawer.render({
      status: "ready",
      thread: { ...thread, outdated: false },
      then,
      now: null,
      commits: [],
      diffOps: [],
    });

    expect(shadow().querySelector(".untouched").textContent).toContain("没有任何提交");
  });
});
