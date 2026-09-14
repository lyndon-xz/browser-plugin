import { ERROR_KIND, GitLabRequestError } from "./client.js";

/*
 * 把 GitLab 的 discussions 归一成抽屉要用的 ReviewThread。只有 type='DiffNote' 且 position
 * 非空的 note 是挂在代码上的评论，系统消息与整条 MR 的评论 position 都是 null。
 */

/** 锚点落在 diff 的哪一侧。new_line 缺失说明这行在新版本已被删掉，只能按旧侧定位 */
export const ANCHOR_SIDE = { old: "old", new: "new" };

/** 「评论时」文件版本里用来切片的锚点行号：旧侧用 old_line，新侧用 new_line */
export function thenAnchorLineFor(thread) {
  const { anchorLine, anchorSide, position } = thread;
  if (anchorSide === ANCHOR_SIDE.old) {
    return position.old_line ?? anchorLine;
  }
  return position.new_line ?? anchorLine;
}

// position_type 不是 text 的 DiffNote 挂在图片或整个文件上，没有行号，进来会产出无从定位的 thread
const isCodeComment = (note) =>
  !note.system &&
  note.type === "DiffNote" &&
  note.position?.position_type === "text";

function toThread(discussion, note, mrHeadSha) {
  const { id: noteId, author, created_at: createdAt, body, position } = note;
  const {
    new_line: newLine,
    old_line: oldLine,
    new_path: newPath,
    old_path: oldPath,
    head_sha: headSha,
  } = position;
  // 评论落在被删掉的行上时只有 old_line，此时锚点要按旧版本那一侧定位
  const anchorSide = newLine == null ? ANCHOR_SIDE.old : ANCHOR_SIDE.new;

  return {
    discussionId: discussion.id,
    noteId,
    author: author.username,
    createdAt,
    body,
    path: anchorSide === ANCHOR_SIDE.new ? newPath : oldPath,
    anchorLine: anchorSide === ANCHOR_SIDE.new ? newLine : oldLine,
    anchorSide,
    position,
    // 评论写下时的 head 与 MR 当前 head 不同，说明这条评论之后代码又动过
    isOutdated: headSha !== mrHeadSha,
    // 同一主题里的后续人类发言：「后来怎么改」的结论通常写在回复里，只看首条会漏掉答案
    replies: discussion.notes
      .filter((reply) => reply !== note && !reply.system)
      .map((reply) => ({
        author: reply.author.username,
        createdAt: reply.created_at,
        body: reply.body,
      })),
  };
}

// GitLab 默认每页 20；一条 MR 的讨论数可以到 70 以上，不放大就会被截断
const DISCUSSIONS_PER_PAGE = 100;

// 页数上限防的是实例侧意外：忽略 page 参数的实例会让「取满一页就再取一页」永远成立
const MAX_PAGES = 20;

/** 讨论分页上限；触达后 discussionsTruncated 为 true */
export const MAX_LOADED_DISCUSSIONS = DISCUSSIONS_PER_PAGE * MAX_PAGES;

async function loadAllDiscussions(client, base) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const batch = await client.get(
      `${base}/discussions?per_page=${DISCUSSIONS_PER_PAGE}&page=${page}`,
    );
    // 错误载荷不是数组，展开它只会抛一个没有 kind 的裸 TypeError，界面只能说「未知错误」
    if (!Array.isArray(batch)) {
      throw new GitLabRequestError(
        ERROR_KIND.unexpected,
        0,
        "讨论列表的响应不是预期的数组",
      );
    }

    all.push(...batch);
    // 取满一页说明后面可能还有；不满就到底了，不必读响应头
    if (batch.length < DISCUSSIONS_PER_PAGE) {
      return { discussions: all, isTruncated: false };
    }
  }
  // 超大 MR 降级为部分加载，总比整条失败强
  return {
    discussions: all,
    isTruncated: true,
  };
}

/** 读取 MR 元数据（含 diff_refs） */
export const loadMergeRequest = (client, ref) =>
  client.get(`/projects/${ref.project}/merge_requests/${ref.mrIid}`);

/** 拉取 MR 讨论并归一为 ReviewThread 列表 */
export async function loadThreads(client, ref) {
  const base = `/projects/${ref.project}/merge_requests/${ref.mrIid}`;
  const [mergeRequest, discussionPage] = await Promise.all([
    loadMergeRequest(client, ref),
    loadAllDiscussions(client, base),
  ]);
  const { discussions, isTruncated } = discussionPage;

  // 不可 diff 的 MR（无提交、冲突严重）没有 diff_refs，直取下一级会抛裸 TypeError
  if (!mergeRequest.diff_refs?.head_sha) {
    throw new GitLabRequestError(
      ERROR_KIND.notFound,
      0,
      "这条 MR 取不到 diff 基准",
    );
  }

  const mrHeadSha = mergeRequest.diff_refs.head_sha;

  // 一个主题只产出一条：锚点取首条代码评论，其余人类发言作为它的回复
  const threads = discussions.flatMap((discussion) => {
    const anchor = discussion.notes.find(isCodeComment);
    return anchor ? [toThread(discussion, anchor, mrHeadSha)] : [];
  });

  return { mergeRequest, threads, discussionsTruncated: isTruncated };
}
