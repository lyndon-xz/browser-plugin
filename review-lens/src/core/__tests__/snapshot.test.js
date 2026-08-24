import { describe, expect, it, vi } from "vitest";

import { CONTEXT_LINES, loadSnapshot, sliceAround, splitLines } from "../snapshot.js";

const PROJECT = "IBUHotelFrontEnd%2Fhtl-multi-detail-page";
const PATH = "src/modules/getHotelDetailAggregate/ctrip/online/collector/hotelInfo.collector.ts";
const SHA = "55c3bb54b7fa132454a6e47d6eb46f128e1f00d1";

const source = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join("\n");

function clientReturning(text) {
  return { getText: vi.fn(async () => text) };
}

describe("splitLines", () => {
  it("splits LF and CRLF alike", () => {
    expect(splitLines("a\nb\nc")).toEqual(["a", "b", "c"]);
    expect(splitLines("a\r\nb\r\nc")).toEqual(["a", "b", "c"]);
  });

  it("drops the trailing empty line a final newline produces", () => {
    expect(splitLines("a\nb\n")).toEqual(["a", "b"]);
  });
});

describe("sliceAround", () => {
  const lines = splitLines(source);

  it("keeps real file line numbers, starting at 1", () => {
    const snapshot = sliceAround(lines, 10);

    expect(snapshot.rangeStart).toBe(10 - CONTEXT_LINES);
    expect(snapshot.rangeEnd).toBe(10 + CONTEXT_LINES);
    expect(snapshot.lines[0]).toEqual({ number: 10 - CONTEXT_LINES, text: `line ${10 - CONTEXT_LINES}` });
    expect(snapshot.anchorLine).toBe(10);
  });

  it("does not run past the first line", () => {
    const snapshot = sliceAround(lines, 2);

    expect(snapshot.rangeStart).toBe(1);
    expect(snapshot.lines[0].number).toBe(1);
  });

  it("does not run past the last line", () => {
    const snapshot = sliceAround(lines, 19);

    expect(snapshot.rangeEnd).toBe(20);
    expect(snapshot.lines.at(-1).number).toBe(20);
  });
});

describe("loadSnapshot", () => {
  it("asks for the file at the given ref with the path fully encoded", async () => {
    const client = clientReturning(source);

    await loadSnapshot(client, { project: PROJECT, path: PATH, sha: SHA, anchorLine: 5 });

    expect(client.getText).toHaveBeenCalledWith(
      `/projects/${PROJECT}/repository/files/${encodeURIComponent(PATH)}/raw?ref=${SHA}`,
    );
  });

  it("returns a snapshot carrying its own sha and path", async () => {
    const snapshot = await loadSnapshot(clientReturning(source), {
      project: PROJECT,
      path: PATH,
      sha: SHA,
      anchorLine: 5,
    });

    expect(snapshot).toMatchObject({ sha: SHA, path: PATH, anchorLine: 5 });
    expect(snapshot.lines.length).toBeGreaterThan(0);
  });
});
