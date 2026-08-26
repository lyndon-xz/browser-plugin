import { describe, it, expect } from "vitest";
import { Matcher } from "../utils/matcher.js";
import { EXAM_QUESTIONS } from "../data/questions.js";

/**
 * M2-S2 全量题库匹配抽样（对应验收 V-5）
 *
 * 从题库中抽样真实题目，用「完整题干 / 截断片段 / 子句乱序」三种查询，
 * 断言 Matcher.match 命中的题目答案与原题一致。
 * 抽样直接取自 EXAM_QUESTIONS，避免硬编码写错。
 */

function pick(type, n) {
  return EXAM_QUESTIONS.filter((q) => q.type === type).slice(0, n);
}

// 覆盖单选 + 多选，至少 5 道
const samples = [...pick("single", 3), ...pick("multi", 4)];

describe("全量题库模糊匹配抽样", () => {
  it("抽样集非空且覆盖两种题型", () => {
    expect(samples.length).toBeGreaterThanOrEqual(5);
    expect(samples.some((q) => q.type === "single")).toBe(true);
    expect(samples.some((q) => q.type === "multi")).toBe(true);
  });

  for (const q of samples) {
    it(`完整题干命中 id=${q.id}`, () => {
      const hit = Matcher.match(EXAM_QUESTIONS, q.title);
      expect(hit).toBeTruthy();
      expect(hit.answer).toEqual(q.answer);
    });

    it(`截断片段命中 id=${q.id}`, () => {
      // 取题干前 60% 且至少 10 字作为截断查询
      const n = Math.max(10, Math.floor(q.title.length * 0.6));
      const partial = q.title.slice(0, n);
      const hit = Matcher.match(EXAM_QUESTIONS, partial);
      expect(hit && hit.answer).toEqual(q.answer);
    });
  }
});
