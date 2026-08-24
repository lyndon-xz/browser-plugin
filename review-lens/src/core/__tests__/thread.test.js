import { describe, expect, it, vi } from "vitest";

import discussions from "./fixtures/discussions.json" with { type: "json" };
import { PER_PAGE, loadThreads } from "../thread.js";

const MR_HEAD = "10f4b6f08220630d1f36613d244610f7bf395924";
const PROJECT = "IBUHotelFrontEnd%2Fhtl-multi-detail-page";

function clientReturning({ head = MR_HEAD } = {}) {
  return {
    get: vi.fn(async (path) => {
      if (path.includes("/discussions")) return discussions;
      return { iid: 2797, target_branch: "master", diff_refs: { head_sha: head } };
    }),
  };
}

const load = (client) => loadThreads(client, { project: PROJECT, mrIid: 2797 });

describe("loadThreads", () => {
  it("keeps only code comments", async () => {
    const threads = await load(clientReturning());

    expect(threads).toHaveLength(3);
    expect(threads.every((thread) => thread.position)).toBe(true);
  });

  it("drops system notes and whole-MR comments", async () => {
    const threads = await load(clientReturning());
    const ids = threads.map((thread) => thread.noteId);

    expect(ids).not.toContain(26712387); // system: true
    expect(ids).not.toContain(26712365); // position: null
  });

  it("carries the fields the drawer renders", async () => {
    const threads = await load(clientReturning());
    const thread = threads.find((item) => item.noteId === 26712695);

    expect(thread).toMatchObject({
      discussionId: "a56515dc2767b789c9c2ec99d90e6cdfc6f6e8d2",
      author: "GitLabAI",
      resolved: false,
      anchorLine: 23,
      path: "src/modules/getHotelDetailAggregate/ctrip/online/collector/hotelDescription.collector.ts",
    });
    expect(thread.body).toContain("buildSoaRequest");
  });

  it("marks a comment outdated when its head differs from the current MR head", async () => {
    const threads = await load(clientReturning());
    const byId = new Map(threads.map((thread) => [thread.noteId, thread]));

    expect(byId.get(26712695).outdated).toBe(true); // head_sha 55c3bb54
    expect(byId.get(26730029).outdated).toBe(false); // head_sha === MR head
  });

  it("uses old_line as the anchor when the comment sits on a deleted line", async () => {
    const threads = await load(clientReturning());
    const thread = threads.find((item) => item.noteId === 26730099);

    expect(thread.anchorLine).toBe(88);
    expect(thread.anchorSide).toBe("old");
  });

  it("brings the replies along, because the fix is usually written there", async () => {
    const threads = await load(clientReturning());
    const thread = threads.find((item) => item.noteId === 26712695);

    expect(thread.replies.map((reply) => reply.author)).toEqual(["xiunn", "cp.tang"]);
    expect(thread.replies[0].body).toContain("Optional.ofNullable");
    expect(thread.replies[0].createdAt).toBe("2026-08-15T10:11:02.000+08:00");
  });

  it("keeps system notes out of the replies", async () => {
    const threads = await load(clientReturning());
    const thread = threads.find((item) => item.noteId === 26712695);

    expect(thread.replies.map((reply) => reply.body)).not.toContain("resolved all threads");
  });

  it("gives a thread with no replies an empty list, not undefined", async () => {
    const threads = await load(clientReturning());
    const thread = threads.find((item) => item.noteId === 26730029);

    expect(thread.replies).toEqual([]);
  });

  it("yields one thread per discussion, so replies do not become their own entries", async () => {
    const threads = await load(clientReturning());
    const ids = threads.map((thread) => thread.discussionId);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("requests the merge request and its discussions once each", async () => {
    const client = clientReturning();

    await load(client);

    expect(client.get).toHaveBeenCalledWith(`/projects/${PROJECT}/merge_requests/2797`);
    expect(client.get).toHaveBeenCalledWith(
      `/projects/${PROJECT}/merge_requests/2797/discussions?per_page=100&page=1`,
    );
    expect(client.get).toHaveBeenCalledTimes(2);
  });

  it("keeps paging while a page comes back full, so late threads are not dropped", async () => {
    // 实测：一条 MR 有 71 个讨论，默认 per_page=20 会把大半截掉
    const codeDiscussion = (id) => ({
      id: `d${id}`,
      notes: [
        {
          id: 900000 + id,
          type: "DiffNote",
          body: "同上",
          author: { username: "cp.tang" },
          system: false,
          created_at: "2026-08-17T15:02:11.000+08:00",
          position: {
            base_sha: "b",
            start_sha: "s",
            head_sha: "55c3bb54",
            position_type: "text",
            new_path: "a/B.java",
            old_path: "a/B.java",
            new_line: 1,
          },
          resolvable: true,
          resolved: false,
        },
      ],
    });
    const fullPage = Array.from({ length: PER_PAGE }, (_, index) => codeDiscussion(index));
    const lastPage = [codeDiscussion(9001), codeDiscussion(9002)];

    const client = {
      get: vi.fn(async (path) => {
        if (!path.includes("/discussions")) {
          return { iid: 2797, target_branch: "master", diff_refs: { head_sha: MR_HEAD } };
        }
        // 注意 per_page=100 里含有 "page=1"，判断必须带上 & 才不会把每页都当第一页
        return path.includes("&page=1") ? fullPage : lastPage;
      }),
    };

    const threads = await load(client);

    const pages = client.get.mock.calls
      .map(([path]) => path)
      .filter((path) => path.includes("/discussions"));
    expect(pages).toHaveLength(2);
    expect(threads).toHaveLength(PER_PAGE + 2);
  });
});
