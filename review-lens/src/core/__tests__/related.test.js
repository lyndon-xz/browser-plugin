import { describe, expect, it } from "vitest";

import { relatedLines } from "../related.js";

const lines = [
  { number: 37, text: "    ResponseEntity<Type> responseEntity =" },
  { number: 38, text: "        ReTryService.doIoService(Exception.class, ctx -> {" },
  { number: 39, text: "          return soaClient.get(request);" },
  { number: 40, text: "        });" },
  { number: 41, text: "    return responseEntity.getResponse().getList();" },
];

const body =
  "用 ReTryService.doIoService 时 responseEntity.getResponse() 是空值，取值前要判 getSuccess()";

describe("relatedLines", () => {
  it("points at the line the comment is really about, not only its anchor", () => {
    const found = relatedLines({ body, lines, anchorLine: 38 });

    expect(found.map((item) => item.line)).toContain(41);
  });

  it("explains why each line is a candidate", () => {
    const found = relatedLines({ body, lines, anchorLine: 38 });
    const line41 = found.find((item) => item.line === 41);

    expect(line41.reason).toContain("responseEntity.getResponse()");
  });

  it("keeps the anchor in the list and says so", () => {
    const found = relatedLines({ body, lines, anchorLine: 38 });
    const anchor = found.find((item) => item.line === 38);

    expect(anchor.reason).toContain("评论锚定");
  });

  it("puts the lines matching more identifiers first", () => {
    const found = relatedLines({
      body: "responseEntity.getResponse() 与 getList() 一起看",
      lines,
      anchorLine: 37,
    });

    expect(found[0].line).toBe(41);
  });

  it("returns nothing to offer when the comment names no code", () => {
    expect(relatedLines({ body: "超时太长了", lines, anchorLine: 38 })).toEqual([]);
  });

  it("does not offer a list when the anchor is the only candidate", () => {
    const found = relatedLines({
      body: "ReTryService.doIoService 用法有问题",
      lines,
      anchorLine: 38,
    });

    expect(found).toEqual([]);
  });
});
