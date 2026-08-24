/*
 * 把 GitLab 的 discussions 归一成抽屉要用的 ReviewThread。
 * 判据来自实测：只有 type='DiffNote' 且 position 非空的 note 才是挂在代码上的评论，
 * 系统消息（"added 1 commit"）与整条 MR 的评论 position 都是 null。
 */

const isCodeComment = (note) => !note.system && note.type === "DiffNote" && note.position;

function toThread(discussion, note, mrHeadSha) {
  const { position } = note;
  // 评论落在被删掉的行上时只有 old_line，此时锚点要按旧版本那一侧定位
  const anchorSide = position.new_line == null ? "old" : "new";

  return {
    discussionId: discussion.id,
    noteId: note.id,
    author: note.author.username,
    createdAt: note.created_at,
    body: note.body,
    resolved: Boolean(note.resolved),
    path: anchorSide === "new" ? position.new_path : position.old_path,
    anchorLine: anchorSide === "new" ? position.new_line : position.old_line,
    anchorSide,
    position,
    // 评论写下时的 head 与 MR 当前 head 不同，说明这条评论之后代码又动过
    outdated: position.head_sha !== mrHeadSha,
    /*
     * 同一主题里锚点之后的人类发言。「后来怎么改」的结论通常就写在这里
     * （如作者回一句「加了 Optional.ofNullable(...)」），只看首条等于把答案漏掉。
     */
    replies: discussion.notes
      .filter((reply) => reply !== note && !reply.system)
      .map((reply) => ({
        author: reply.author.username,
        createdAt: reply.created_at,
        body: reply.body,
      })),
  };
}

// GitLab 默认每页 20；实测一条 MR 有 71 个讨论，不放大就会被截断
export const PER_PAGE = 100;

async function loadAllDiscussions(client, base) {
  const all = [];
  for (let page = 1; ; page += 1) {
    const batch = await client.get(`${base}/discussions?per_page=${PER_PAGE}&page=${page}`);
    all.push(...batch);
    // 取满一页说明后面可能还有；不满就到底了，不必读响应头
    if (batch.length < PER_PAGE) return all;
  }
}

export const loadMergeRequest = (client, { project, mrIid }) =>
  client.get(`/projects/${project}/merge_requests/${mrIid}`);

export async function loadThreads(client, ref) {
  const base = `/projects/${ref.project}/merge_requests/${ref.mrIid}`;
  const [mergeRequest, discussions] = await Promise.all([
    loadMergeRequest(client, ref),
    loadAllDiscussions(client, base),
  ]);

  const mrHeadSha = mergeRequest.diff_refs.head_sha;

  // 一个主题只产出一条：锚点取首条代码评论，其余人类发言作为它的回复
  return discussions.flatMap((discussion) => {
    const anchor = discussion.notes.find(isCodeComment);
    return anchor ? [toThread(discussion, anchor, mrHeadSha)] : [];
  });
}
