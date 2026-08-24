import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import discussions from "../../core/__tests__/fixtures/discussions.json" with { type: "json" };
import { ENTRY_CLASS, init } from "../entry.js";
import { HOST_TAG } from "../../ui/drawer.js";

const ORIGIN = "https://git.dev.sh.ctripcorp.com";
const PATHNAME = "/IBUHotelFrontEnd/htl-multi-detail-page/-/merge_requests/2797";
const MR_HEAD = "10f4b6f08220630d1f36613d244610f7bf395924";

// 定位靠方法名，所以夹具得是真代码：锚点行 23 落在 collect() 里
const fileWith = (body) => [
  "package a;",
  "",
  "public class Collector {",
  ...Array.from({ length: 18 }, (_, index) => `  // padding ${index + 1}`),
  "  public void collect(Request request) {",
  ...body,
  "  }",
  "}",
].join("\n");

// 两个版本必须真有差异，否则 compare 判为 unchanged、右侧只给一句结论而不是第二栏（DD-48）
const THEN_BODY = ['    options.push("HostRating");', '    extras.enableHostInfo = "T";', "    return options;"];
const NOW_BODY = ['    options.push("HostRating");', "    return options;"];


// 折叠的讨论容器：容器内没有 note 元素，只有 .discussion-actions（实测结构）
function discussionElement(discussionId) {
  const box = document.createElement("div");
  box.className = "discussion js-discussion-container";
  box.dataset.discussionId = discussionId;
  const actions = document.createElement("div");
  actions.className = "discussion-actions";
  box.append(actions);
  return box;
}

/*
 * 三个容器对应 fixture 里的三种讨论：前两个含 DiffNote，
 * 3a390baf… 是 GitLab AI 的整体评论（position: null），不该挂入口。
 */
const CODE_DISCUSSIONS = [
  "a56515dc2767b789c9c2ec99d90e6cdfc6f6e8d2",
  "c69aadfb482786cf42c131c3391a3ce0d9195d71",
];
const PLAIN_DISCUSSION = "3a390baf97ba8834a889a90e545786fe3de813e6";

function renderDiscussions() {
  const list = document.createElement("div");
  list.className = "main-notes-list";
  list.append(...[...CODE_DISCUSSIONS, PLAIN_DISCUSSION].map(discussionElement));
  document.body.replaceChildren(list);
}

function fakeFetch({ discussionStatus = 200 } = {}) {
  return vi.fn(async (url) => {
    if (url.includes("/discussions")) {
      return {
        ok: discussionStatus === 200,
        status: discussionStatus,
        headers: { get: () => "1" },
        json: async () => discussions,
        text: async () => "",
      };
    }
    if (url.includes("/repository/files/")) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({}),
        text: async () => fileWith(url.includes(MR_HEAD) ? NOW_BODY : THEN_BODY),
      };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ iid: 2797, target_branch: "master", diff_refs: { head_sha: MR_HEAD } }),
      text: async () => "",
    };
  });
}

const start = (fetchImpl) =>
  init({
    origin: ORIGIN,
    location: { pathname: PATHNAME, origin: ORIGIN },
    root: document.body,
    fetchImpl,
    loadStyleText: async () => "",
    reportActive,
  });

const entries = () => [...document.querySelectorAll(`.${ENTRY_CLASS}`)];
const ownerOf = (entry) => entry.closest("[data-discussion-id]").dataset.discussionId;
const shadow = () => document.body.querySelector(HOST_TAG)?.shadowRoot ?? null;

let teardown;
let reportActive;

beforeEach(() => {
  document.body.replaceChildren();
  renderDiscussions();
  reportActive = vi.fn(async () => {});
});

afterEach(() => {
  teardown?.();
  teardown = undefined;
});

describe("init", () => {
  it("puts entries only on the threads the API reported as code discussions", async () => {
    teardown = await start(fakeFetch());

    expect(entries().map(ownerOf)).toEqual(CODE_DISCUSSIONS);
  });

  it("opens the drawer with the code as it looked when the comment was written", async () => {
    const fetchImpl = fakeFetch();
    teardown = await start(fetchImpl);

    entries()[0].click();
    await vi.waitFor(() => expect(shadow()?.querySelectorAll("[data-line]").length).toBeGreaterThan(0));

    // a56515dc… 的 position.head_sha 是 55c3bb54，锚点行 23
    const requested = fetchImpl.mock.calls.map(([url]) => url).find((url) => url.includes("/raw?ref="));
    expect(requested).toContain("ref=55c3bb54b7fa132454a6e47d6eb46f128e1f00d1");
    expect(shadow().querySelector(".code-line.anchor").dataset.line).toBe("23");
    expect(shadow().textContent).toContain("hotelDescription.collector.ts");
  });

  it("puts both versions in the drawer, fetching each at its own sha", async () => {
    const fetchImpl = fakeFetch();
    teardown = await start(fetchImpl);

    entries()[0].click();
    await vi.waitFor(() => expect(shadow()?.querySelectorAll(".pane").length).toBe(2));

    const refs = fetchImpl.mock.calls
      .map(([url]) => url)
      .filter((url) => url.includes("/raw?ref="))
      .map((url) => url.split("ref=")[1]);
    // 评论那条的 head 是 55c3bb54，MR 当前 head 是 10f4b6f0
    expect(refs).toContain("55c3bb54b7fa132454a6e47d6eb46f128e1f00d1");
    expect(refs).toContain(MR_HEAD);
  });

  it("still offers entries when the discussions call fails, and explains on click", async () => {
    teardown = await start(fakeFetch({ discussionStatus: 401 }));

    expect(entries()).toHaveLength(3);

    entries()[0].click();
    await vi.waitFor(() => expect(shadow()?.querySelector(".failure")).toBeTruthy());
    expect(shadow().textContent).toContain("401");
  });

  it("reports the page as usable, so the toolbar icon lights up", async () => {
    teardown = await start(fakeFetch());

    expect(reportActive).toHaveBeenCalledTimes(1);
  });

  it("keeps the entries even if reporting fails", async () => {
    reportActive.mockRejectedValueOnce(new Error("扩展后台没有响应"));

    teardown = await start(fakeFetch());

    expect(entries()).toHaveLength(2);
  });

  it("does nothing on a page that is not a merge request", async () => {
    teardown = await init({
      origin: ORIGIN,
      location: { pathname: "/group/repo/-/issues/3", origin: ORIGIN },
      root: document.body,
      fetchImpl: fakeFetch(),
      loadStyleText: async () => "",
      reportActive,
    });

    expect(entries()).toHaveLength(0);
    expect(shadow()).toBeNull();
    expect(reportActive).not.toHaveBeenCalled();
  });
});
