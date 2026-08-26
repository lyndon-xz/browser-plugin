import { diffLines } from "./code/diff.js";
import { locateInNewVersion } from "./code/locate.js";
import { sliceForReading } from "./code/snapshot.js";
import { loadFile } from "./gitlab/file.js";
import { ANCHOR_SIDE } from "./gitlab/thread.js";

/**
 * 一条评论的「评论时 ↔ 当前」对照结果，按读者需要区分的结论分三态，不按算法路径分：
 * changed 两侧都有内容可逐行对照；unchanged 这段还是评论时那样，问题仍然成立；
 * unlocatable 在当前分支上找不到对应位置，右侧只给线索不给代码。
 * now 只在 changed 时有值——它就是「有没有第二份代码可以对照」本身。
 */
export const COMPARE_STATE = {
  changed: "changed",
  unchanged: "unchanged",
  unlocatable: "unlocatable",
};

const COMMITS_PER_PAGE = 100;

/*
 * branch 要传这条 MR 的源分支：方法改名或删除发生在源分支上，查目标分支通常一条提交都查不到。
 * 带 path 过滤，返回的是动过这个文件的提交，不是该分支的所有提交。
 */
const commitsSince = (client, query) => {
  const { project, path, branch, since } = query;

  return client.get(
    `/projects/${project}/repository/commits` +
      `?path=${encodeURIComponent(path)}` +
      `&ref_name=${encodeURIComponent(branch)}` +
      `&since=${encodeURIComponent(since)}` +
      `&per_page=${COMMITS_PER_PAGE}`,
  );
};

/*
 * diff 基准固定为两侧方法体，与「上下各多看几行」无关：着色是这段代码的客观事实，不随视口变。
 * op 里带的是文件绝对行号，渲染时按行号直接对上，省掉一层偏移换算。
 */
function diffOfBase(thenBase, nowBase) {
  const ops = diffLines(
    thenBase.lines.map((line) => line.text),
    nowBase.lines.map((line) => line.text),
  );

  return ops.map((op) => ({
    ...op,
    thenLine:
      op.thenLine === null ? null : op.thenLine + thenBase.rangeStart - 1,
    nowLine: op.nowLine === null ? null : op.nowLine + nowBase.rangeStart - 1,
  }));
}

export async function buildComparePair(client, request) {
  const { project, thread, mrHeadSha, sourceBranch, extraLines = 0 } = request;

  // 锚点在旧侧时行号属于 base_sha 那个版本，拿 head_sha 去切同一行号会切到别处
  const anchorSha =
    thread.anchorSide === ANCHOR_SIDE.old
      ? (thread.position.base_sha ??
        thread.position.start_sha ??
        thread.position.head_sha)
      : thread.position.head_sha;

  const oldLines = await loadFile(client, {
    project,
    path: thread.path,
    sha: anchorSha,
  });
  const sliceOld = (extra) =>
    sliceForReading(oldLines, thread.anchorLine, {
      extraLines: extra,
      sha: anchorSha,
      path: thread.path,
    });
  const then = sliceOld(extraLines);

  // 三种结局里有两种要它，参数每次都一样
  const touchedSinceComment = () =>
    commitsSince(client, {
      project,
      path: thread.path,
      branch: sourceBranch,
      since: thread.createdAt,
    });

  // 锚点行已经不在这个版本里，谈不上对照，也没有可展示的片段
  if (!then) {
    return {
      state: COMPARE_STATE.unlocatable,
      then: null,
      now: null,
      commits: await touchedSinceComment(),
      diffOps: [],
    };
  }

  if (!thread.isOutdated) {
    return {
      state: COMPARE_STATE.unchanged,
      then,
      now: null,
      commits: await touchedSinceComment(),
      diffOps: [],
    };
  }

  const newLines = await loadFile(client, {
    project,
    path: thread.path,
    sha: mrHeadSha,
  });
  const located = locateInNewVersion({
    oldLines,
    newLines,
    anchorLine: thread.anchorLine,
  });

  if (!located) {
    // 找不到位置时给出线索：评论之后谁改过这个文件。全量给出，显示几条是展示层的事
    const commits = await touchedSinceComment();
    return {
      state: COMPARE_STATE.unlocatable,
      then,
      now: null,
      commits,
      diffOps: [],
    };
  }

  const sliceNew = (extra) =>
    sliceForReading(newLines, located.anchorLine, {
      extraLines: extra,
      sha: mrHeadSha,
      path: thread.path,
    });
  const now = sliceNew(extraLines);
  const diffOps = diffOfBase(sliceOld(0), sliceNew(0));

  // 「改没改」只在这里判一次，界面直接读结论，徽标、着色与「N 行有改动」不会各说一套
  if (diffOps.some((op) => op.type !== "keep")) {
    return { state: COMPARE_STATE.changed, then, now, commits: [], diffOps };
  }

  // 逐行相同：与「评论就挂在当前版本上」是同一个结论，依据也走同一个查询
  return {
    state: COMPARE_STATE.unchanged,
    then,
    now: null,
    commits: await touchedSinceComment(),
    diffOps: [],
  };
}
