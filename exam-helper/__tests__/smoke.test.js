import { describe, it, expect } from "vitest";
import { EXAM_QUESTIONS } from "../data/questions.js";

describe("种子题库 EXAM_QUESTIONS", () => {
  it("是非空数组", () => {
    expect(Array.isArray(EXAM_QUESTIONS)).toBe(true);
    expect(EXAM_QUESTIONS.length).toBeGreaterThan(0);
  });

  it("每题含 id/type/title/answer 字段且格式合法", () => {
    for (const q of EXAM_QUESTIONS) {
      expect(typeof q.id).toBe("number");
      expect(["single", "multi"]).toContain(q.type);
      expect(typeof q.title).toBe("string");
      expect(q.title.length).toBeGreaterThan(0);
      expect(Array.isArray(q.answer)).toBe(true);
      expect(q.answer.length).toBeGreaterThan(0);
    }
  });

  it("包含至少一个单选和一个多选（种子覆盖两种题型）", () => {
    const types = new Set(EXAM_QUESTIONS.map((q) => q.type));
    expect(types.has("single")).toBe(true);
    expect(types.has("multi")).toBe(true);
  });
});
