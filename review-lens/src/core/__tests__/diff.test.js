import { describe, expect, it } from "vitest";

import { diffLines } from "../diff.js";

const types = (ops) => ops.map((op) => op.type);
const textOf = (ops, type) => ops.filter((op) => op.type === type).map((op) => op.text);

describe("diffLines", () => {
  it("marks every line kept when nothing changed", () => {
    const lines = ["a", "b", "c"];

    expect(types(diffLines(lines, lines))).toEqual(["keep", "keep", "keep"]);
  });

  it("marks appended lines as added", () => {
    const ops = diffLines(["a"], ["a", "b"]);

    expect(types(ops)).toEqual(["keep", "add"]);
    expect(textOf(ops, "add")).toEqual(["b"]);
  });

  it("marks dropped lines as removed", () => {
    const ops = diffLines(["a", "b"], ["a"]);

    expect(types(ops)).toEqual(["keep", "remove"]);
    expect(textOf(ops, "remove")).toEqual(["b"]);
  });

  it("reports a replaced line as a removal plus an addition", () => {
    const ops = diffLines(["a", "old", "c"], ["a", "new", "c"]);

    expect(textOf(ops, "remove")).toEqual(["old"]);
    expect(textOf(ops, "add")).toEqual(["new"]);
    expect(types(ops).filter((type) => type === "keep")).toHaveLength(2);
  });

  it("carries the line number each side actually has", () => {
    const ops = diffLines(["a", "old"], ["a", "new", "tail"]);
    const kept = ops.find((op) => op.type === "keep");
    const removed = ops.find((op) => op.type === "remove");
    const added = ops.filter((op) => op.type === "add");

    expect(kept).toMatchObject({ thenLine: 1, nowLine: 1 });
    expect(removed).toMatchObject({ thenLine: 2, nowLine: null });
    expect(added.map((op) => op.nowLine)).toEqual([2, 3]);
    expect(added.every((op) => op.thenLine === null)).toBe(true);
  });

  it("treats an indentation-only change as a change, because Java indentation carries meaning", () => {
    const ops = diffLines(["if (a) {"], ["    if (a) {"]);

    expect(types(ops)).toEqual(["remove", "add"]);
  });

  it("handles an empty side", () => {
    expect(types(diffLines([], ["a", "b"]))).toEqual(["add", "add"]);
    expect(types(diffLines(["a"], []))).toEqual(["remove"]);
    expect(diffLines([], [])).toEqual([]);
  });

  it("stays fast enough for a long method", () => {
    const before = Array.from({ length: 500 }, (_, index) => `line ${index}`);
    const after = before.map((line, index) => (index === 250 ? "changed" : line));

    const started = performance.now();
    const ops = diffLines(before, after);

    expect(performance.now() - started).toBeLessThan(50);
    expect(textOf(ops, "add")).toEqual(["changed"]);
  });
});
