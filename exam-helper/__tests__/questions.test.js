import { describe, it, expect } from "vitest";
import { EXAM_QUESTIONS } from "../data/questions.js";

/**
 * M2-S2 题库完整性校验（对应验收 V-5）
 * 全量题库应结构一致、答案合法、无重复题干。
 */

// 与 matcher.normalize 一致的简易归一化，用于查重
function normalize(text) {
  let s = String(text == null ? "" : text);
  if (typeof s.normalize === "function") s = s.normalize("NFKC");
  s = s.toLowerCase().replace(/\s+/g, "");
  s = s.replace(/[!-/:-@[-`{-~]/g, "");
  s = s.replace(
    /[\u3000-\u303F\uFF00-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65\u2018\u2019\u201C\u201D\u2026\u3001\u3002\uFE30-\uFE4F]/g,
    "",
  );
  return s;
}

describe("全量题库 EXAM_QUESTIONS 完整性", () => {
  it("规模达到全量量级（>= 60 题）", () => {
    expect(EXAM_QUESTIONS.length).toBeGreaterThanOrEqual(60);
  });

  it("每题 type 合法、title 非空", () => {
    for (const q of EXAM_QUESTIONS) {
      expect(["single", "multi"]).toContain(q.type);
      expect(typeof q.title).toBe("string");
      expect(q.title.trim().length).toBeGreaterThan(0);
    }
  });

  it("每题 answer 为非空数组且元素均为单个大写字母 A-E", () => {
    for (const q of EXAM_QUESTIONS) {
      expect(Array.isArray(q.answer)).toBe(true);
      expect(q.answer.length).toBeGreaterThan(0);
      for (const a of q.answer) expect(/^[A-E]$/.test(a)).toBe(true);
    }
  });

  it("options 若存在，每项含 key 与 text", () => {
    for (const q of EXAM_QUESTIONS) {
      if (!q.options) continue;
      for (const o of q.options) {
        expect(typeof o.key).toBe("string");
        expect(typeof o.text).toBe("string");
      }
    }
  });

  it("id 全局唯一", () => {
    const ids = EXAM_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("归一化题干无重复", () => {
    const seen = new Map();
    const dups = [];
    for (const q of EXAM_QUESTIONS) {
      const k = normalize(q.title);
      if (seen.has(k)) dups.push(q.title);
      else seen.set(k, true);
    }
    expect(dups).toEqual([]);
  });
});
