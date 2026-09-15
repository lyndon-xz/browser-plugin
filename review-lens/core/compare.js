import { diffLines } from "./code/diff.js";
import { locateInNewVersion } from "./code/locate.js";
import { sliceForDiff, sliceForReading } from "./code/snapshot.js";
import { loadFile } from "./gitlab/file.js";
import { ANCHOR_SIDE, thenAnchorLineFor } from "./gitlab/thread.js";

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
const MAX_COMMIT_PAGES = 10;

/*
 * branch 要传这条 MR 的源分支：方法改名或删除发生在源分支上，查目标分支通常一条提交都查不到。
 * 带 path 过滤，返回的是动过这个文件的提交，不是该分支的所有提交。
 */
async function fetchAllCommits(client, query) {
  const { project, path, branch, since } = query;
  const all = [];

  for (let page = 1; page <= MAX_COMMIT_PAGES; page += 1) {
    const batch = await client.get(
      `/projects/${project}/repository/commits` +
        `?path=${encodeURIComponent(path)}` +
        `&ref_name=${encodeURIComponent(branch)}` +
        `&since=${encodeURIComponent(since)}` +
        `&per_page=${COMMITS_PER_PAGE}&page=${page}`,
    );

    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    all.push(...batch);
    if (batch.length < COMMITS_PER_PAGE) {
      return { commits: all, isTruncated: false };
    }
  }

  return {
    commits: all,
    isTruncated: true,
  };
}

const commitsTouchedSince = async (client, query) => {
  try {
    const result = await fetchAllCommits(client, query);
    return { ...result, fetchFailed: false };
  } catch {
    // 提交列表是线索，不是对照的前提：取不到就空着，主结论照样给
    return { commits: [], isTruncated: false, fetchFailed: true };
  }
};

/*
 * diff 基准固定为两侧方法体，与「上下各多看几行」无关：着色是这段代码的客观事实，不随视口变。
 * op 里带的是文件绝对行号，渲染时按行号直接对上，省掉一层偏移换算。
 */
function buildResliceCache(request) {
  const {
    oldLines,
    newLines,
    locatedAnchorLine,
    path,
    thenAnchorLine,
    state,
    commits,
    commitsTruncated,
    commitsFetchFailed,
    diffOps,
  } = request;
  if (!oldLines) {
    return null;
  }
  return {
    oldLines,
    newLines: newLines ?? null,
    locatedAnchorLine: locatedAnchorLine ?? null,
    path,
    thenAnchorLine,
    state,
    commits,
    commitsTruncated,
    commitsFetchFailed: commitsFetchFailed ?? false,
    diffOps,
  };
}

/** 扩行时只重切片段，复用已加载的文件内容与对照结论，不再打 API */
export function resliceComparePair(cache, extraLines = 0) {
  const {
    oldLines,
    newLines,
    locatedAnchorLine,
    path,
    thenAnchorLine,
    state,
    commits,
    commitsTruncated,
    commitsFetchFailed,
    diffOps,
  } = cache;

  const then = sliceForReading(oldLines, thenAnchorLine, { extraLines, path });
  if (!then) {
    return {
      state: COMPARE_STATE.unlocatable,
      then: null,
      now: null,
      commits,
      commitsTruncated,
      commitsFetchFailed,
      diffOps: [],
    };
  }

  if (
    state === COMPARE_STATE.changed &&
    newLines &&
    locatedAnchorLine != null
  ) {
    const now = sliceForReading(newLines, locatedAnchorLine, {
      extraLines,
      path,
    });
    return {
      state,
      then,
      now,
      commits,
      commitsTruncated,
      commitsFetchFailed,
      diffOps,
    };
  }

  if (state === COMPARE_STATE.unchanged) {
    return {
      state,
      then,
      now: null,
      commits,
      commitsTruncated,
      commitsFetchFailed,
      diffOps: [],
    };
  }

  return {
    state,
    then,
    now: null,
    commits,
    commitsTruncated,
    commitsFetchFailed,
    diffOps: [],
  };
}

function diffOfBase(thenBase, nowBase) {
  const ops = diffLines(
    thenBase.lines.map((line) => line.text),
    nowBase.lines.map((line) => line.text),
  );

  return ops.map((op) => ({
    type: op.type,
    thenLine:
      op.thenLine === null ? null : op.thenLine + thenBase.rangeStart - 1,
    nowLine: op.nowLine === null ? null : op.nowLine + nowBase.rangeStart - 1,
  }));
}

/** 构建一条评论的「评论时 ↔ 当前」对照结果 */
export async function buildComparePair(client, request) {
  const { project, thread, mrHeadSha, sourceBranch, extraLines = 0 } = request;
  const { path, anchorLine, anchorSide, position, isOutdated, createdAt } =
    thread;
  const thenAnchorLine = thenAnchorLineFor(thread);

  // 锚点在旧侧时行号属于 base_sha 那个版本，拿 head_sha 去切同一行号会切到别处
  const anchorSha =
    anchorSide === ANCHOR_SIDE.old
      ? (position.base_sha ?? position.start_sha ?? position.head_sha)
      : position.head_sha;

  const oldLines = await loadFile(client, {
    project,
    path,
    sha: anchorSha,
  });
  const sliceOld = (extra) =>
    sliceForReading(oldLines, thenAnchorLine, {
      extraLines: extra,
      path,
    });
  const then = sliceOld(extraLines);

  // 三种结局里有两种要它，参数每次都一样
  const touchedSinceComment = async () => {
    const { commits, isTruncated, fetchFailed } = await commitsTouchedSince(
      client,
      {
        project,
        path,
        branch: sourceBranch,
        since: createdAt,
      },
    );
    return {
      commits,
      commitsTruncated: isTruncated,
      commitsFetchFailed: fetchFailed,
    };
  };

  // 锚点行已经不在这个版本里，谈不上对照，也没有可展示的片段
  if (!then) {
    const { commits, commitsTruncated, commitsFetchFailed } =
      await touchedSinceComment();
    return {
      state: COMPARE_STATE.unlocatable,
      then: null,
      now: null,
      commits,
      commitsTruncated,
      commitsFetchFailed,
      diffOps: [],
      resliceCache: buildResliceCache({
        oldLines,
        path,
        thenAnchorLine,
        state: COMPARE_STATE.unlocatable,
        commits,
        commitsTruncated,
        commitsFetchFailed,
        diffOps: [],
      }),
    };
  }

  if (!isOutdated) {
    const { commits, commitsTruncated, commitsFetchFailed } =
      await touchedSinceComment();
    return {
      state: COMPARE_STATE.unchanged,
      then,
      now: null,
      commits,
      commitsTruncated,
      commitsFetchFailed,
      diffOps: [],
      resliceCache: buildResliceCache({
        oldLines,
        path,
        thenAnchorLine,
        state: COMPARE_STATE.unchanged,
        commits,
        commitsTruncated,
        commitsFetchFailed,
        diffOps: [],
      }),
    };
  }

  const newLines = await loadFile(client, {
    project,
    path,
    sha: mrHeadSha,
  });
  const located = locateInNewVersion({
    oldLines,
    newLines,
    anchorLine: thenAnchorLine,
    path,
  });

  if (!located) {
    const { commits, commitsTruncated, commitsFetchFailed } =
      await touchedSinceComment();
    // 找不到位置时给出线索：评论之后谁改过这个文件。全量给出，显示几条是展示层的事
    return {
      state: COMPARE_STATE.unlocatable,
      then,
      now: null,
      commits,
      commitsTruncated,
      commitsFetchFailed,
      diffOps: [],
      resliceCache: buildResliceCache({
        oldLines,
        path,
        thenAnchorLine,
        state: COMPARE_STATE.unlocatable,
        commits,
        commitsTruncated,
        commitsFetchFailed,
        diffOps: [],
      }),
    };
  }

  const now = sliceForReading(newLines, located.anchorLine, {
    extraLines,
    path,
  });
  const thenDiff = sliceForDiff(oldLines, thenAnchorLine, { path });
  const nowDiff = sliceForDiff(newLines, located.anchorLine, { path });
  const diffOps = thenDiff && nowDiff ? diffOfBase(thenDiff, nowDiff) : [];

  // 「改没改」只在这里判一次，界面直接读结论，徽标、着色与「N 行有改动」不会各说一套
  if (diffOps.some((op) => op.type !== "keep")) {
    return {
      state: COMPARE_STATE.changed,
      then,
      now,
      commits: [],
      commitsTruncated: false,
      commitsFetchFailed: false,
      diffOps,
      resliceCache: buildResliceCache({
        oldLines,
        newLines,
        locatedAnchorLine: located.anchorLine,
        path,
        thenAnchorLine,
        state: COMPARE_STATE.changed,
        commits: [],
        commitsTruncated: false,
        commitsFetchFailed: false,
        diffOps,
      }),
    };
  }

  const { commits, commitsTruncated, commitsFetchFailed } =
    await touchedSinceComment();
  // 逐行相同：与「评论就挂在当前版本上」是同一个结论，依据也走同一个查询
  return {
    state: COMPARE_STATE.unchanged,
    then,
    now: null,
    commits,
    commitsTruncated,
    commitsFetchFailed,
    diffOps: [],
    resliceCache: buildResliceCache({
      oldLines,
      newLines,
      locatedAnchorLine: located.anchorLine,
      path,
      thenAnchorLine,
      state: COMPARE_STATE.unchanged,
      commits,
      commitsTruncated,
      commitsFetchFailed,
      diffOps: [],
    }),
  };
}
