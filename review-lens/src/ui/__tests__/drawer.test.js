import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDrawer, HOST_TAG } from "../drawer.js";

const thread = {
  discussionId: "a56515dc",
  noteId: 26712695,
  author: "cp.tang",
  createdAt: "2026-08-14T18:02:38.417+08:00",
  body: "用 ReTryService.doIoService 时 responseEntity.getResponse() 是空值",
  path: "src/modules/getHotelDetailAggregate/ctrip/online/collector/hotelInfo.collector.ts",
  anchorLine: 19,
  outdated: true,
};

const snapshot = {
  sha: "55c3bb54b7fa132454a6e47d6eb46f128e1f00d1",
  path: thread.path,
  anchorLine: 19,
  rangeStart: 17,
  rangeEnd: 21,
  lines: [
    { number: 17, text: "  const request = new GetContractSummaryRequestType();" },
    { number: 18, text: "" },
    { number: 19, text: "  return responseEntity.getResponse().getList<Item>();" },
    { number: 20, text: "}" },
    { number: 21, text: "" },
  ],
};

const readyState = { status: "ready", thread, then: snapshot };

let drawer;

beforeEach(() => {
  document.body.replaceChildren();
  drawer = createDrawer({ styleText: ".drawer { color: red }" });
});

afterEach(() => {
  drawer.close();
});

const host = () => document.body.querySelector(HOST_TAG);
const shadow = () => host().shadowRoot;
const codeLines = () => [...shadow().querySelectorAll("[data-line]")];

describe("createDrawer", () => {
  it("mounts one host node at the end of the body with a shadow root", () => {
    drawer.render(readyState);

    expect(document.body.querySelectorAll(HOST_TAG)).toHaveLength(1);
    expect(document.body.lastElementChild).toBe(host());
    expect(shadow()).toBeTruthy();
  });

  it("does not mount a second host when rendered again", () => {
    drawer.render(readyState);
    drawer.render(readyState);

    expect(document.body.querySelectorAll(HOST_TAG)).toHaveLength(1);
  });

  it("shows where the comment came from and what it says", () => {
    drawer.render(readyState);
    const text = shadow().textContent;

    expect(text).toContain("hotelInfo.collector.ts");
    expect(text).toContain("cp.tang");
    expect(text).toContain("responseEntity.getResponse()");
  });

  it("renders every line of the snapshot with its real line number", () => {
    drawer.render(readyState);

    expect(codeLines()).toHaveLength(snapshot.lines.length);
    expect(codeLines()[0].dataset.line).toBe("17");
    expect(codeLines().at(-1).dataset.line).toBe("21");
  });

  it("marks the anchor line so the reader sees what the comment points at", () => {
    drawer.render(readyState);
    const anchored = codeLines().filter((line) => line.classList.contains("anchor"));

    expect(anchored).toHaveLength(1);
    expect(anchored[0].dataset.line).toBe("19");
  });

  it("writes code as text, so page content cannot inject elements", () => {
    drawer.render(readyState);
    const anchor = codeLines().find((line) => line.dataset.line === "19");

    expect(anchor.querySelector("item")).toBeNull();
    expect(anchor.textContent).toContain("getList<Item>()");
  });

  it("dates the anchor comment, so it is not a bare name next to the replies", () => {
    drawer.render(readyState);

    expect(shadow().querySelector(".comment-card-top").textContent).toContain("2026-08-14");
  });

  it("says what the comparison found, in plain words", () => {
    const cases = [
      { state: "changed", text: "评论后代码已改动" },
      { state: "unchanged", text: "至今未改动" },
      { state: "unlocatable", text: "代码已不在当前分支" },
    ];

    for (const { state, text } of cases) {
      drawer.close();
      drawer.render({ ...readyState, state });

      const badge = shadow().querySelector(".comment-card-top .badge");
      expect(badge.textContent).toBe(text);
      // 徽标不参与琥珀/青瓷语义，那套颜色的无歧义性来自空间位置（DD-41）
      expect(badge.className).not.toMatch(/badge-(then|now|gone)/);
      expect(badge.textContent).not.toContain("旧版本差异");
    }
  });

  it("falls back to what the comment itself knows before the comparison lands", () => {
    drawer.render({ status: "loading", thread });

    expect(shadow().querySelector(".badge").textContent).toBe("评论后代码已改动");
  });

  it("shows no badge when there is nothing to flag", () => {
    drawer.render({ status: "loading", thread: { ...thread, outdated: false } });

    expect(shadow().querySelector(".badge")).toBeNull();
  });

  it("heads the replies so they read as replies, not as sibling comments", () => {
    drawer.render({
      ...readyState,
      thread: {
        ...thread,
        replies: [{ author: "xiunn", createdAt: "2026-05-19T10:11:02.000+08:00", body: "改成30" }],
      },
    });

    expect(shadow().querySelector(".replies-head").textContent).toContain("回复");
    expect(shadow().querySelector(".replies-head").textContent).toContain("1");
  });

  it("shows the replies, in the order they were written", () => {
    drawer.render({
      ...readyState,
      thread: {
        ...thread,
        replies: [
          { author: "xiunn", createdAt: "2026-08-15T10:11:02.000+08:00", body: "加了 Optional.ofNullable(...)" },
          { author: "cp.tang", createdAt: "2026-08-15T11:03:41.000+08:00", body: "可以，这样兜住了空值。" },
        ],
      },
    });
    const replies = [...shadow().querySelectorAll(".reply")];

    expect(replies).toHaveLength(2);
    expect(replies[0].textContent).toContain("xiunn");
    expect(replies[0].textContent).toContain("Optional.ofNullable");
    expect(replies[1].textContent).toContain("cp.tang");
  });

  it("leaves no empty reply block when nobody replied", () => {
    drawer.render({ ...readyState, thread: { ...thread, replies: [] } });

    expect(shadow().querySelector(".replies")).toBeNull();
  });

  it("does not claim a change when the code did not change (DD-45)", () => {
    drawer.render({ ...readyState, state: "unchanged", now: null, commits: [], diffOps: [] });

    const badge = shadow().querySelector(".badge").textContent;

    expect(badge).toContain("未改动");
    expect(badge).not.toContain("已改动");
    // 一模一样的代码不摆第二遍，右侧给一句结论（DD-48）
    expect(shadow().querySelectorAll(".pane")).toHaveLength(1);
  });

  describe("截图附件（DD-44）", () => {
    const site = { origin: "https://git.example.com", projectPath: "group/service" };
    const withSite = () => createDrawer({ styleText: "", site });
    const replyBody = "![image](/uploads/b39a0791/image.png) 改成这种";

    it("shows the screenshot a reply is made of, instead of its Markdown", () => {
      drawer = withSite();
      drawer.render({
        ...readyState,
        thread: { ...thread, replies: [{ author: "xiunn", createdAt: "2026-08-17", body: replyBody }] },
      });

      const image = shadow().querySelector(".reply .shot");

      expect(image.tagName).toBe("IMG");
      expect(image.getAttribute("src")).toBe("https://git.example.com/group/service/uploads/b39a0791/image.png");
      expect(shadow().querySelector(".reply").textContent).toContain("改成这种");
      expect(shadow().querySelector(".reply").textContent).not.toContain("![image]");
    });

    it("shows a screenshot pasted into the anchor comment too", () => {
      drawer = withSite();
      drawer.render({ ...readyState, thread: { ...thread, body: replyBody } });

      expect(shadow().querySelector(".comment-card .shot")).toBeTruthy();
    });

    it("opens the full-size picture when it is clicked", () => {
      drawer = withSite();
      drawer.render({ ...readyState, thread: { ...thread, body: replyBody } });

      const link = shadow().querySelector(".comment-card .shot").parentElement;

      expect(link.tagName).toBe("A");
      expect(link.target).toBe("_blank");
      expect(link.href).toBe("https://git.example.com/group/service/uploads/b39a0791/image.png");
    });

    it("will not fetch a picture from anywhere but the host itself", () => {
      drawer = withSite();
      const written = "![tracker](https://elsewhere.example/pixel.png)";
      drawer.render({ ...readyState, thread: { ...thread, body: written } });

      expect(shadow().querySelector(".shot")).toBeNull();
      expect(shadow().querySelector(".comment-card").textContent).toContain(written);
    });

    it("writes a body that looks like markup as text, never as markup", () => {
      drawer = withSite();
      const written = '<img src=x onerror="alert(1)">';
      drawer.render({ ...readyState, thread: { ...thread, body: written } });

      // 宿主页的正文不可信，任何时候都不拼 HTML
      expect(shadow().querySelector(".comment-card img")).toBeNull();
      expect(shadow().querySelector(".comment-card").textContent).toContain("onerror");
    });

    it("keeps the identifiers in a reply clickable", () => {
      drawer = withSite();
      drawer.render({
        ...readyState,
        thread: {
          ...thread,
          replies: [{ author: "xiunn", createdAt: "2026-08-17", body: "改了 responseEntity.getResponse()" }],
        },
      });

      expect(shadow().querySelector(".reply .ident")).toBeTruthy();
    });
  });

  it("closes when the page outside the drawer is clicked", () => {
    drawer.render(readyState);

    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(host()).toBeNull();
  });

  it("stays open when the click lands inside the drawer", () => {
    drawer.render(readyState);

    shadow()
      .querySelector(".drawer")
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));

    expect(host()).not.toBeNull();
  });

  it("stops the page behind it from scrolling", () => {
    document.body.style.overflow = "auto";

    drawer.render(readyState);
    expect(document.body.style.overflow).toBe("hidden");

    drawer.close();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("restores an overflow that was never set", () => {
    document.body.style.overflow = "";

    drawer.render(readyState);
    drawer.close();

    expect(document.body.style.overflow).toBe("");
  });

  it("removes the host node when closed", () => {
    drawer.render(readyState);
    drawer.close();

    expect(host()).toBeNull();
  });

  it("closes on Escape", () => {
    drawer.render(readyState);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(host()).toBeNull();
  });

  it("shows a loading state before the code arrives", () => {
    drawer.render({ status: "loading", thread });

    expect(shadow().textContent).toContain("cp.tang");
    expect(codeLines()).toHaveLength(0);
  });
});
