import { describe, it, expect } from "vitest";
import { Matcher } from "../utils/matcher.js";

/**
 * M1-S2 匹配引擎测试（对应验收 V-2：模糊匹配）
 * 覆盖：归一化、完全一致、多余空格、全角标点、乱序、截断、无关文本、返回结构。
 *
 * 用本地 FIXTURE 而非真实题库，使匹配引擎单测与题库内容/编号解耦；
 * 全量题库上的匹配回归见 matcher.fulldb.test.js。
 */

const FIXTURE = [
  {
    id: 1,
    type: "multi",
    title:
      "关于多线程并行处理定时任务的情况，下列哪些说法符合《阿里巴巴Java开发手册》：",
    answer: ["B", "C", "D"],
    explain: "Timer 会终止所有任务；推荐 ScheduledExecutorService。",
  },
  {
    id: 2,
    type: "single",
    title:
      "KV结构的集合，在处理null值的存储上有细微的区别，下列哪个说法是正确的：",
    answer: ["A"],
    explain: "TreeMap 的 key 不可为 null。",
  },
];

describe("Matcher.normalize 归一化", () => {
  it("去除所有空白字符", () => {
    expect(Matcher.normalize("a b\tc\n d")).toBe("abcd");
  });

  it("英文转小写", () => {
    expect(Matcher.normalize("TreeMap")).toBe("treemap");
  });

  it("全角字符转半角（NFKC）", () => {
    expect(Matcher.normalize("Ｊａｖａ　１２３")).toBe("java123");
  });

  it("剔除标点符号（中英文）", () => {
    expect(Matcher.normalize("你好，世界！（test）：")).toBe("你好世界test");
  });
});

describe("Matcher.match 模糊匹配", () => {
  it("完全一致命中，返回对应题目", () => {
    const hit = Matcher.match(FIXTURE, FIXTURE[0].title);
    expect(hit).toBeTruthy();
    expect(hit.id).toBe(1);
    expect(hit.answer).toEqual(["B", "C", "D"]);
    expect(typeof hit.explain).toBe("string");
  });

  it("多余空格 + 全角标点仍命中", () => {
    const noisy =
      "关于多线程 并行处理定时任务的情况，  下列哪些说法符合《阿里巴巴Ｊava开发手册》：";
    const hit = Matcher.match(FIXTURE, noisy);
    expect(hit && hit.id).toBe(1);
  });

  it("题干截断（只选中一部分）仍命中", () => {
    const partial = "并行处理定时任务的情况，下列哪些说法符合";
    const hit = Matcher.match(FIXTURE, partial);
    expect(hit && hit.id).toBe(1);
  });

  it("语序打乱（子句顺序不同）仍命中", () => {
    const reordered =
      "下列哪些说法符合《阿里巴巴Java开发手册》关于多线程并行处理定时任务的情况";
    const hit = Matcher.match(FIXTURE, reordered);
    expect(hit && hit.id).toBe(1);
  });

  it("匹配到正确的那道题而非其他题（题干片段）", () => {
    const hit = Matcher.match(
      FIXTURE,
      "KV结构的集合，在处理null值的存储上有细微的区别",
    );
    expect(hit && hit.id).toBe(2);
    expect(hit.answer).toEqual(["A"]);
  });

  it("无关文本返回 null", () => {
    expect(Matcher.match(FIXTURE, "今天天气不错适合出去玩")).toBeNull();
  });

  it("空文本返回 null", () => {
    expect(Matcher.match(FIXTURE, "   ")).toBeNull();
    expect(Matcher.match(FIXTURE, "")).toBeNull();
  });
});
