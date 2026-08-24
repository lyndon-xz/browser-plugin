import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderCardList } from "../cards-view.js";

const cardAt = (project, symbol, nowCode = "timeout(30);") => ({
  id: `c_${symbol}`,
  savedAt: "2026-08-19T15:00:00.000Z",
  source: {
    origin: "https://git.dev.sh.ctripcorp.com",
    project,
    mrIid: 27,
    discussionId: symbol,
    path: `a/${symbol}.java`,
    line: 32,
    webUrl: `https://git/-/merge_requests/27#note_${symbol}`,
  },
  symbol: `${symbol}()`,
  comment: { author: "cp.tang", createdAt: "2026-05-19T10:00:00.000+08:00", body: "超时太长" },
  replies: [],
  thenCode: "timeout(60 * 3);",
  nowCode,
  note: "笔记",
});

const cards = [
  cardAt("hoteldynamicinfo/buyoutservice", "Dao"),
  cardAt("hoteldynamicinfo/buyoutservice", "Service"),
  cardAt("IBUHotelFrontEnd/htl-multi-detail-page", "Collector", null),
];

let root;
let onDelete;

beforeEach(() => {
  document.body.replaceChildren();
  root = document.createElement("div");
  document.body.append(root);
  onDelete = vi.fn(async () => {});
});

const render = (list = cards) => renderCardList(root, { cards: list, onDelete });
const items = () => [...root.querySelectorAll(".card")];
const chips = () => [...root.querySelectorAll(".chip")];

describe("renderCardList", () => {
  it("lists every card", () => {
    render();

    expect(items()).toHaveLength(3);
  });

  it("offers a filter per repository, with counts that add up", () => {
    render();

    const labels = chips().map((chip) => chip.textContent);
    expect(labels[0]).toContain("全部");
    expect(labels[0]).toContain("3");
    expect(labels.join(" ")).toContain("buyoutservice");
    expect(labels.join(" ")).toContain("2");
  });

  it("narrows the list to the chosen repository", () => {
    render();

    chips().find((chip) => chip.textContent.includes("buyoutservice")).click();

    expect(items()).toHaveLength(2);
  });

  it("shows the before and after side by side on each card", () => {
    render();
    const [first] = items();

    expect(first.querySelector(".m-then").textContent).toContain("timeout(60 * 3);");
    expect(first.querySelector(".m-now").textContent).toContain("timeout(30);");
  });

  it("says 至今未改动 on a card whose code never changed", () => {
    render();
    const untouched = items().find((item) => item.textContent.includes("Collector"));

    expect(untouched.querySelector(".m-now").textContent).toContain("至今未改动");
  });

  it("deletes through the caller and drops the row", async () => {
    render();

    items()[0].querySelector(".danger").click();
    await vi.waitFor(() => expect(items()).toHaveLength(2));

    expect(onDelete).toHaveBeenCalledWith("c_Dao");
  });

  it("invites the first card when there is nothing yet", () => {
    render([]);

    expect(root.textContent).toContain("还没有卡片");
    expect(items()).toHaveLength(0);
  });

  it("shows no dead controls in the empty state", () => {
    render([]);

    // 0 张卡片时「全部 0」按了没反应，不该出现（DD-28）
    expect(chips()).toHaveLength(0);
    expect(root.querySelector(".list")).toBeNull();
  });

  it("tells the reader what to do, not just that it is empty", () => {
    render([]);

    expect(root.textContent).toContain("解读");
  });
});
