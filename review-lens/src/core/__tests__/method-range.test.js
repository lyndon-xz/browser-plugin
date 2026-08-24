import { describe, expect, it } from "vitest";

import { findMethodRange } from "../snapshot.js";

/*
 *  1 package a;
 *  2
 *  3 public class Dao {
 *  4   /** doc *\/
 *  5   public List<Detail> query(...) throws SQLException {
 *  6     if (ids.isEmpty()) {
 *  7       return Collections.emptyList();
 *  8     }
 *  9     Runnable task = new Runnable() {
 * 10       public void run() {
 * 11         log("{ unbalanced");
 * 12       }
 * 13     };
 * 14     return dao.query(sql, ids);
 * 15   }
 * 16
 * 17   private void other() {
 * 18     return;
 * 19   }
 * 20 }
 */
const source = `package a;

public class Dao {
  /** doc */
  public List<Detail> query(List<Long> ids) throws SQLException {
    if (ids.isEmpty()) {
      return Collections.emptyList();
    }
    Runnable task = new Runnable() {
      public void run() {
        log("{ unbalanced");
      }
    };
    return dao.query(sql, ids);
  }

  private void other() {
    return;
  }
}`.split("\n");

describe("findMethodRange", () => {
  it("spans from the signature to the matching closing brace", () => {
    expect(findMethodRange(source, 14)).toEqual({ start: 5, end: 15 });
  });

  it("does not count braces that live inside a string literal", () => {
    // 第 11 行的 "{ unbalanced" 若被计入，query 的花括号永远配不平
    expect(findMethodRange(source, 14).end).toBe(15);
  });

  it("gives the nearest enclosing method, even inside an anonymous class", () => {
    expect(findMethodRange(source, 11)).toEqual({ start: 10, end: 12 });
  });

  it("still resolves when the anchor is the closing brace itself", () => {
    expect(findMethodRange(source, 15)).toEqual({ start: 5, end: 15 });
  });

  it("finds the method the anchor is actually in, not the first one in the file", () => {
    expect(findMethodRange(source, 18)).toEqual({ start: 17, end: 19 });
  });

  it("returns null when no enclosing method can be found", () => {
    expect(findMethodRange(["int x = 1;", "int y = 2;"], 1)).toBeNull();
  });

  /*
   * 控制语句的形状与方法签名一致（标识符 + 括号 + 花括号），真机上
   * `if (request.getCountryName() != null) {` 曾被当成方法签名，
   * 于是「展开完整方法体」只展开了那个 if 块。
   */
  const withControlFlow = `  public void build(List<ParamEntity> list, Request request) {
    if (request.getCountryName() != null) {
      list.add(buildParamEntity("country", request.getCountryName()));
    } else if (request.getCity() != null) {
      for (String city : request.getCity()) {
        try {
          list.add(buildParamEntity("city", city));
        } catch (Exception e) {
          log(e);
        }
      }
    }
    return;
  }`.split("\n");

  it("skips control statements that look like signatures", () => {
    // 第 3 行在 if 块里，第 5 行是 for，第 6 行是 try，第 8 行是 catch
    for (const anchor of [3, 5, 6, 8]) {
      expect(findMethodRange(withControlFlow, anchor)).toEqual({ start: 1, end: 14 });
    }
  });

  it("still recognises the method signature itself", () => {
    expect(findMethodRange(withControlFlow, 1)).toEqual({ start: 1, end: 14 });
  });
});
