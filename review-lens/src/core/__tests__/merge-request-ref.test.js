import { describe, expect, it } from "vitest";

import { parseMergeRequestRef } from "../page.js";

const at = (pathname) => ({ pathname });

describe("parseMergeRequestRef", () => {
  it("reads the project path and the merge request iid", () => {
    expect(parseMergeRequestRef(at("/IBUHotelFrontEnd/htl-multi-detail-page/-/merge_requests/2797"))).toEqual(
      {
        project: "IBUHotelFrontEnd%2Fhtl-multi-detail-page",
        projectPath: "IBUHotelFrontEnd/htl-multi-detail-page",
        mrIid: "2797",
      },
    );
  });

  it("handles nested groups", () => {
    expect(parseMergeRequestRef(at("/group/sub/repo/-/merge_requests/12"))).toEqual({
      project: "group%2Fsub%2Frepo",
      // 原样保留一份：附件 URL 拼的是路径，不是 API 的 :id
      projectPath: "group/sub/repo",
      mrIid: "12",
    });
  });

  it("ignores what follows the iid", () => {
    expect(parseMergeRequestRef(at("/group/repo/-/merge_requests/12/diffs"))).toEqual({
      project: "group%2Frepo",
      projectPath: "group/repo",
      mrIid: "12",
    });
  });

  it("returns null where there is no merge request to read", () => {
    expect(parseMergeRequestRef(at("/group/repo/-/issues/12"))).toBeNull();
    expect(parseMergeRequestRef(at("/group/repo/-/merge_requests"))).toBeNull();
    expect(parseMergeRequestRef(at("/"))).toBeNull();
  });
});
