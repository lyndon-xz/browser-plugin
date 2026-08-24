import { describe, expect, it } from "vitest";

import { tokenizeJava } from "../highlight.js";

const kinds = (line) => tokenizeJava(line).map((token) => token.kind);
const of = (line, kind) =>
  tokenizeJava(line)
    .filter((token) => token.kind === kind)
    .map((token) => token.text);

describe("tokenizeJava", () => {
  it("puts the line back together exactly as it came in", () => {
    const lines = [
      '    String sql = "select * from t where id in (?)";',
      "    DalHints hints = DalHints.createIfAbsent(null).timeout(60 * 3);",
      "    // 超时按最慢的正常请求给",
      "    return dao.query(sql, hints, SQLResult.type(Detail.class), ids);",
      "",
    ];

    for (const line of lines) {
      expect(tokenizeJava(line).map((token) => token.text).join("")).toBe(line);
    }
  });

  it("marks keywords", () => {
    expect(of("    return new Detail();", "keyword")).toEqual(["return", "new"]);
    expect(of("  public static void main(String[] args) {", "keyword")).toEqual([
      "public",
      "static",
      "void",
    ]);
  });

  it("marks strings and leaves what is inside them alone", () => {
    expect(of('String s = "return new";', "string")).toEqual(['"return new"']);
    // 字符串里的 return/new 不该被当成关键字
    expect(of('String s = "return new";', "keyword")).toEqual([]);
  });

  it("marks a line comment and swallows the rest of the line", () => {
    expect(of("  int x = 1; // return new", "comment")).toEqual(["// return new"]);
    // 注释里的 return / new 不该被当成关键字，注释之前的 int 仍然是
    expect(of("  int x = 1; // return new", "keyword")).toEqual(["int"]);
  });

  it("marks numbers", () => {
    expect(of("    timeout(60 * 3);", "number")).toEqual(["60", "3"]);
  });

  it("marks type names by their leading capital", () => {
    expect(of("    DalHints hints = new DalHints();", "type")).toEqual(["DalHints", "DalHints"]);
  });

  it("does not mistake a lowercase identifier for a type", () => {
    expect(of("    dao.query(sql);", "type")).toEqual([]);
  });

  it("handles an empty line and a line of only whitespace", () => {
    expect(tokenizeJava("")).toEqual([]);
    expect(kinds("    ")).toEqual(["plain"]);
  });

  it("marks a char literal", () => {
    expect(of("    char c = 'x';", "string")).toEqual(["'x'"]);
  });
});
