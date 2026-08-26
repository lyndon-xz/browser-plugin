import { describe, it, expect } from "vitest";
import { Matcher } from "../utils/matcher.js";
import { EXAM_QUESTIONS } from "../data/questions.js";

/**
 * M1-S2 匹配引擎测试（对应验收 V-2：模糊匹配）
 * 覆盖：归一化、完全一致、多余空格、全角标点、乱序、截断、无关文本、返回结构。
 */

describe("Matcher.normalize 归一化", () => {
  it("去除所有空白字符", () => {
    expect(Matcher.normalize("a b\tc\n d")).toBe("abcd");
  });

  it("英文转小写", () => {
    expect(Matcher.normalize("TreeMap")).toBe("treemap");
  });

  it("全角字符转半角（NFKC）", () => {
    // 全角字母数字、全角空格
    expect(Matcher.normalize("Ｊａｖａ　１２３")).toBe("java123");
  });

  it("剔除标点符号（中英文）", () => {
    expect(Matcher.normalize("你好，世界！（test）：")).toBe("你好世界test");
  });
});

describe("Matcher.match 模糊匹配", () => {
  const q1 = EXAM_QUESTIONS.find((q) => q.id === 1); // 多选 定时任务
  const q2 = EXAM_QUESTIONS.find((q) => q.id === 2); // 单选 TreeMap null

  it("完全一致命中，返回对应题目", () => {
    const hit = Matcher.match(EXAM_QUESTIONS, q1.title);
    expect(hit).toBeTruthy();
    expect(hit.id).toBe(1);
    expect(hit.answer).toEqual(["B", "C", "D"]);
    expect(typeof hit.explain).toBe("string");
  });

  it("多余空格 + 全角标点仍命中", () => {
    const noisy =
      "关于多线程 并行处理定时任务的情况，  下列哪些说法符合《阿里巴巴Ｊava开发手册》：";
    const hit = Matcher.match(EXAM_QUESTIONS, noisy);
    expect(hit && hit.id).toBe(1);
  });

  it("题干截断（只选中一部分）仍命中", () => {
    const partial = "并行处理定时任务的情况，下列哪些说法符合";
    const hit = Matcher.match(EXAM_QUESTIONS, partial);
    expect(hit && hit.id).toBe(1);
  });

  it("语序打乱（子句顺序不同）仍命中", () => {
    const reordered =
      "下列哪些说法符合《阿里巴巴Java开发手册》关于多线程并行处理定时任务的情况";
    const hit = Matcher.match(EXAM_QUESTIONS, reordered);
    expect(hit && hit.id).toBe(1);
  });

  it("匹配到正确的那道题而非其他题（题干片段）", () => {
    // 选中 q2 题干的一部分，应命中 id=2 而非 id=1
    const hit = Matcher.match(
      EXAM_QUESTIONS,
      "KV结构的集合，在处理null值的存储上有细微的区别",
    );
    expect(hit && hit.id).toBe(2);
    expect(hit.answer).toEqual(["A"]);
  });

  it("无关文本返回 null", () => {
    expect(Matcher.match(EXAM_QUESTIONS, "今天天气不错适合出去玩")).toBeNull();
  });

  it("空文本返回 null", () => {
    expect(Matcher.match(EXAM_QUESTIONS, "   ")).toBeNull();
    expect(Matcher.match(EXAM_QUESTIONS, "")).toBeNull();
  });
});
