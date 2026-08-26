import { loadMergeRequest, loadThreads } from "../core/gitlab/thread.js";

/**
 * 这条 MR 的评审数据：讨论按 discussionId 索引，外加对照要用的两个基准（当前 head、源分支）。
 * 取讨论失败不抛给调用方而是记在 error 上——入口仍要挂出来，让用户点开看到失败原因。
 */
export function createThreads(request) {
  const { client, ref } = request;

  let byDiscussion = new Map();
  let mergeRequest = null;
  let error = null;

  return {
    // 重试要真的重来一次：不清掉上一次的结果与错误，「重试」按钮点几次都撞在同一份错误上
    async reload() {
      error = null;
      byDiscussion = new Map();
      try {
        // client 按 path 缓存，与 loadThreads 内部那次取 MR 合起来只发一轮请求
        mergeRequest = await loadMergeRequest(client, ref);
        const threads = await loadThreads(client, ref);
        byDiscussion = new Map(
          threads.map((thread) => [thread.discussionId, thread]),
        );
      } catch (loadError) {
        error = loadError;
      }
    },

    get error() {
      return error;
    },

    get discussionIds() {
      return new Set(byDiscussion.keys());
    },

    /*
     * 只在 reload 成功后读得到：loadThreads 已经拦下没有 diff_refs 的 MR 并抛带 kind 的错误，
     * 所以走到这里 head_sha 一定在。
     */
    get mrHeadSha() {
      return mergeRequest.diff_refs.head_sha;
    },

    // 源分支：这条 MR 自己的改动都在这里，目标分支上未必有
    get sourceBranch() {
      return mergeRequest.source_branch;
    },

    threadFor: (discussionId) => byDiscussion.get(discussionId) ?? null,
  };
}
