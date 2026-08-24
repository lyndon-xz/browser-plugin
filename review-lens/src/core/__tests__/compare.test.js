import { describe, expect, it, vi } from "vitest";

import { buildComparePair } from "../compare.js";

const PROJECT = "hoteldynamicinfo%2Fbuyoutservice";
const MR_HEAD = "1aba8de0d14eefe531816121cb515e758dae7638";
const COMMENT_HEAD = "55c3bb54b7fa132454a6e47d6eb46f128e1f00d1";

const THEN_SOURCE = [
  "class Dao {",
  "  void run() {",
  "    int timeout = 180;",
  "  }",
  "}",
].join("\n");
// 当前版本：方法整体下移两行，超时值改了
const NOW_SOURCE = [
  "class Dao {",
  "  Dao() {}",
  "",
  "  void run() {",
  "    int timeout = 30;",
  "  }",
  "}",
].join("\n");

function threadAt({ outdated }) {
  return {
    path: "a/Dao.java",
    anchorLine: 3,
    createdAt: "2026-05-19T10:00:00.000+08:00",
    outdated,
    position: { head_sha: COMMENT_HEAD },
  };
}

function clientWith({ commitsSince = [] } = {}) {
  return {
    getText: vi.fn(async (path) => (path.includes(MR_HEAD) ? NOW_SOURCE : THEN_SOURCE)),
    get: vi.fn(async () => commitsSince),
  };
}

const build = (client, thread) =>
  buildComparePair(client, {
    project: PROJECT,
    thread,
    mrHeadSha: MR_HEAD,
    targetBranch: "master",
  });

describe("buildComparePair", () => {
  /*
   * outdated 只说明 MR 有了新版本，后续提交完全可能改的是文件别处——
   * 那时这段方法两侧逐行相同，读者的结论与「评论就挂在当前版本上」完全一样（DD-45、DD-49）。
   */
  it("calls the code unchanged when the method itself did not change", async () => {
    const client = {
      getText: vi.fn(async () => THEN_SOURCE),
      get: vi.fn(async () => [{ id: "c1" }]),
    };

    const pair = await build(client, threadAt({ outdated: true }));

    expect(pair.state).toBe("unchanged");
    // 没有第二份代码可摆，右侧给的是结论；依据走的是同一个提交查询
    expect(pair.now).toBeNull();
    expect(pair.commits).toHaveLength(1);
  });

  it("reaches the same state whether the comment is outdated or not", async () => {
    const unchangedFile = () => ({ getText: vi.fn(async () => THEN_SOURCE), get: vi.fn(async () => []) });

    const onOldVersion = await build(unchangedFile(), threadAt({ outdated: true }));
    const onCurrent = await build(unchangedFile(), threadAt({ outdated: false }));

    expect(onOldVersion.state).toBe(onCurrent.state);
  });

  it("still reports a real change as changed", async () => {
    const pair = await build(clientWith(), threadAt({ outdated: true }));

    expect(pair.state).toBe("changed");
    expect(pair.diffOps.some((op) => op.type !== "keep")).toBe(true);
  });

  it("fetches the current version when the comment sits on an older one", async () => {
    const client = clientWith();

    const pair = await build(client, threadAt({ outdated: true }));

    const refs = client.getText.mock.calls.map(([path]) => path);
    expect(refs.some((path) => path.includes(COMMENT_HEAD))).toBe(true);
    expect(refs.some((path) => path.includes(MR_HEAD))).toBe(true);
    expect(pair.now).not.toBeNull();
  });

  it("diffs the two versions it fetched", async () => {
    const pair = await build(clientWith(), threadAt({ outdated: true }));

    const changed = pair.diffOps.filter((op) => op.type !== "keep").map((op) => op.text.trim());
    expect(changed).toEqual(["int timeout = 180;", "int timeout = 30;"]);
  });

  it("hands back the commits that touched the file instead of inventing a diff", async () => {
    const client = clientWith({ commitsSince: [{ id: "c1" }, { id: "c2" }] });

    const pair = await build(client, threadAt({ outdated: false }));

    expect(pair.now).toBeNull();
    // path 过滤下这些就是动过该文件的提交，全量给出，截断是展示层的事
    expect(pair.commits).toHaveLength(2);
    expect(client.getText).toHaveBeenCalledTimes(1);
    const [commitsPath] = client.get.mock.calls.at(-1);
    expect(commitsPath).toContain("/repository/commits");
    expect(commitsPath).toContain("since=2026-05-19T10%3A00%3A00.000%2B08%3A00");
    expect(commitsPath).toContain("ref_name=master");
  });

  it("says nothing touched the file when no commit came after the comment", async () => {
    const pair = await build(clientWith({ commitsSince: [] }), threadAt({ outdated: false }));

    expect(pair.now).toBeNull();
    expect(pair.commits).toEqual([]);
  });

  it("diffs against the method body, so widening does not change the colouring", async () => {
    const client = clientWith();

    const tight = await build(client, threadAt({ outdated: true }));
    const wide = await buildComparePair(client, {
      project: PROJECT,
      thread: threadAt({ outdated: true }),
      mrHeadSha: MR_HEAD,
      targetBranch: "master",
      extraLines: 5,
    });

    // 基准固定为方法体，扩视口不影响 diff 结论（DD-42）
    expect(wide.diffOps).toEqual(tight.diffOps);
    expect(wide.then.lines.length).toBeGreaterThan(tight.then.lines.length);
  });

  it("carries absolute line numbers, so the pane can match by line", async () => {
    const pair = await build(clientWith(), threadAt({ outdated: true }));
    const removed = pair.diffOps.find((op) => op.type === "remove");

    // 旧版 timeout 在第 3 行
    expect(removed.thenLine).toBe(3);
  });

  it("hands back who touched the file when the code cannot be located", async () => {
    const client = {
      getText: vi.fn(async (path) =>
        path.includes(MR_HEAD) ? NOW_SOURCE.replace("void run()", "void execute()") : THEN_SOURCE,
      ),
      get: vi.fn(async () => [
        { id: "c1", title: "重命名 run 为 execute", author_name: "xiunn", created_at: "2026-05-19T10:00:00+08:00", web_url: "https://git/c1" },
      ]),
    };

    const pair = await build(client, threadAt({ outdated: true }));

    expect(pair.state).toBe("unlocatable");
    expect(pair.now).toBeNull();
    expect(pair.commits).toHaveLength(1);
    expect(pair.commits[0].title).toContain("execute");
  });

  it("always says which of the three it is, and never leaves the reader with nothing", async () => {
    const outdated = await build(clientWith(), threadAt({ outdated: true }));
    const current = await build(clientWith(), threadAt({ outdated: false }));

    for (const pair of [outdated, current]) {
      expect(["changed", "unchanged", "unlocatable"]).toContain(pair.state);
      // 没有第二份代码时必须有依据可讲
      expect(pair.now !== null || Array.isArray(pair.commits)).toBe(true);
    }
  });
});
