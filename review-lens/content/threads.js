import { loadMergeRequest, loadThreads } from "../core/gitlab/thread.js";

/**
 * 这条 MR 的评审数据：讨论按 discussionId 索引，外加对照要用的两个基准（当前 head、源分支）。
 * 取讨论失败不抛给调用方而是记在 error 上——入口仍要挂出来，让用户点开看到失败原因。
 */
export function createThreads(request) {
  const { client, ref } = request;

  let byDiscussion = new Map();
  let mergeRequest = null;
  let threadsError = null;
  let discussionsTruncated = false;
  let reloadTail = Promise.resolve();

  /**
   * 重拉讨论与 MR 快照。成功后再替换内存数据；刷新过程中保留旧列表，避免点开「解读」时 map 为空。
   */
  async function reloadNow() {
    try {
      client.invalidate(`/projects/${ref.project}/merge_requests/${ref.mrIid}`);
      const loaded = await loadThreads(client, ref);
      mergeRequest = loaded.mergeRequest;
      discussionsTruncated = loaded.discussionsTruncated;
      byDiscussion = new Map(
        loaded.threads.map((thread) => [thread.discussionId, thread]),
      );
      threadsError = null;
    } catch (loadError) {
      threadsError = loadError;
    }
  }

  return {
    /** 重拉讨论与 MR 快照（串行） */
    reload() {
      const run = reloadTail.then(reloadNow, reloadNow);
      reloadTail = run.catch(() => {});
      return run;
    },

    /** 等进行中的 reload 结束；打开抽屉前先等，避免读到半空的讨论列表 */
    whenReady() {
      return reloadTail;
    },

    get threadsError() {
      return threadsError;
    },

    get discussionsTruncated() {
      return discussionsTruncated;
    },

    get discussionIds() {
      return new Set(byDiscussion.keys());
    },

    /*
     * 只在 reload 成功后读得到：loadThreads 已经拦下没有 diff_refs 的 MR 并抛带 kind 的错误，
     * 所以走到这里 head_sha 一定在。
     */
    get mrHeadSha() {
      return mergeRequest?.diff_refs?.head_sha ?? null;
    },

    // 源分支：这条 MR 自己的改动都在这里，目标分支上未必有
    get sourceBranch() {
      return mergeRequest?.source_branch ?? null;
    },

    threadFor: (discussionId) => byDiscussion.get(discussionId) ?? null,

    /** 只刷新 MR head，不重拉讨论列表；扩行时用来判断对照基准是否过期 */
    async refreshHead() {
      try {
        client.invalidate(
          `/projects/${ref.project}/merge_requests/${ref.mrIid}`,
        );
        mergeRequest = await loadMergeRequest(client, ref);
        return mergeRequest?.diff_refs?.head_sha ?? null;
      } catch {
        return null;
      }
    },
  };
}
