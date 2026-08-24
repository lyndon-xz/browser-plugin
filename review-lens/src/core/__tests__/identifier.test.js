import { describe, expect, it } from "vitest";

import { extractIdentifiers, locateIdentifiers } from "../identifier.js";

const texts = (found) => found.map((item) => item.text);

describe("extractIdentifiers", () => {
  it("picks the class and method names out of a Chinese comment", () => {
    const body =
      "用 ReTryService.doIoService 的时候需要注意：发生 NullPointerException 时 responseEntity.getResponse() 是个空值";

    expect(texts(extractIdentifiers(body))).toEqual([
      "ReTryService.doIoService",
      "NullPointerException",
      "responseEntity.getResponse()",
    ]);
  });

  it("keeps each identifier once, in the order it first appeared", () => {
    const body = "getResponse() 是空值，所以用 getResponse() 前要判断 getSuccess()";

    expect(texts(extractIdentifiers(body))).toEqual(["getResponse()", "getSuccess()"]);
  });

  it("reads identifiers out of inline code spans too", () => {
    expect(texts(extractIdentifiers("改成 `DalHints.createIfAbsent(null)` 就行"))).toEqual([
      "DalHints.createIfAbsent(null)",
    ]);
  });

  it("finds nothing in a sentence that names no code", () => {
    expect(extractIdentifiers("超时配置太长了，建议改短一点")).toEqual([]);
  });

  it("does not mistake plain words for identifiers", () => {
    // 单个小写词、纯数字、中文都不算标识符
    expect(texts(extractIdentifiers("这里 the value is 180 太长"))).toEqual([]);
  });

  it("survives an empty body", () => {
    expect(extractIdentifiers("")).toEqual([]);
    expect(extractIdentifiers(undefined)).toEqual([]);
  });
});

describe("locateIdentifiers", () => {
  const lines = [
    { number: 30, text: "  DalHints hints = DalHints.createIfAbsent(null).timeout(60 * 3);" },
    { number: 31, text: "  return dao.query(sql, hints);" },
    { number: 32, text: "  // getResponse() 在这里没出现" },
  ];

  it("reports which lines mention each identifier", () => {
    const found = locateIdentifiers(["DalHints.createIfAbsent", "dao.query"], lines);

    expect(found).toEqual([
      { text: "DalHints.createIfAbsent", lines: [30] },
      { text: "dao.query", lines: [31] },
    ]);
  });

  it("matches on the bare name when the call parentheses are part of the identifier", () => {
    const found = locateIdentifiers(["dao.query(sql, hints)"], lines);

    expect(found[0].lines).toEqual([31]);
  });

  it("keeps identifiers the code never mentions, with no lines", () => {
    const found = locateIdentifiers(["NullPointerException"], lines);

    expect(found).toEqual([{ text: "NullPointerException", lines: [] }]);
  });
});
