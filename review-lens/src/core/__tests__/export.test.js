import { describe, expect, it } from "vitest";

import { toMarkdown } from "../export.js";

const card = {
  id: "c_1",
  savedAt: "2026-08-19T15:00:00.000Z",
  source: {
    origin: "https://git.dev.sh.ctripcorp.com",
    project: "hoteldynamicinfo/buyoutservice",
    mrIid: 27,
    discussionId: "1d3bb93a",
    path: "buyoutservice-dao/src/main/java/Dao.java",
    line: 32,
    webUrl: "https://git.dev.sh.ctripcorp.com/hoteldynamicinfo/buyoutservice/-/merge_requests/27#note_1",
  },
  symbol: "getBankGuaranteeDetailByContractIds()",
  comment: { author: "cp.tang", createdAt: "2026-05-19T10:00:00.000+08:00", body: "超时配置180s，太长了" },
  replies: [{ author: "xiunn", createdAt: "2026-05-19T11:00:00.000+08:00", body: "改成30" }],
  thenCode: "DalHints hints = DalHints.createIfAbsent(null).timeout(60 * 3);",
  nowCode: "DalHints hints = DalHints.createIfAbsent(null).timeout(30);",
  note: "DAL 超时按最慢的正常请求给",
};

describe("toMarkdown", () => {
  it("puts code in java fences, unescaped", () => {
    const markdown = toMarkdown([card]);

    expect(markdown).toContain("```java\nDalHints hints = DalHints.createIfAbsent(null).timeout(60 * 3);\n```");
  });

  it("keeps the trail back to the review", () => {
    const markdown = toMarkdown([card]);

    expect(markdown).toContain(card.source.webUrl);
    expect(markdown).toContain("Dao.java:32");
  });

  it("carries the comment, the replies and my own note", () => {
    const markdown = toMarkdown([card]);

    expect(markdown).toContain("超时配置180s，太长了");
    expect(markdown).toContain("xiunn");
    expect(markdown).toContain("改成30");
    expect(markdown).toContain("DAL 超时按最慢的正常请求给");
  });

  it("says the code never changed instead of printing an empty block", () => {
    const markdown = toMarkdown([{ ...card, nowCode: null }]);

    expect(markdown).toContain("至今未改动");
    expect(markdown).not.toMatch(/```java\n```/);
  });

  it("lengthens the fence when the code itself contains one", () => {
    const markdown = toMarkdown([{ ...card, thenCode: "String doc = \"```\";" }]);

    expect(markdown).toContain("````java");
  });

  it("never leaks an access token, whatever the card holds", () => {
    const markdown = toMarkdown([{ ...card, note: "见设置" }]);

    expect(markdown).not.toContain("glpat");
  });

  it("writes one section per card, newest first", () => {
    const older = { ...card, id: "c_0", savedAt: "2026-08-18T15:00:00.000Z", symbol: "older()" };
    const markdown = toMarkdown([card, older]);

    expect(markdown.indexOf("getBankGuaranteeDetailByContractIds()")).toBeLessThan(
      markdown.indexOf("older()"),
    );
  });

  it("produces a usable document even with no cards", () => {
    expect(toMarkdown([])).toContain("还没有卡片");
  });
});
