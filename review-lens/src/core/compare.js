import { diffLines } from "./diff.js";
import { locateInNewVersion } from "./locate.js";
import { loadFile, sliceForReading } from "./snapshot.js";

/*
 * 把一条评论变成「评论时 ↔ 当前」的对照。结果有三种，用一个判别态表达，
 * 而不是让调用方去猜几个 null 的组合（DD-34）。三种按「读者需要区分的结果」分，
 * 不按「怎么算出来的」分（DD-49）：
 *
 *   changed     —— 这段代码改过，两侧都有内容，可以逐行对照
 *   unchanged   —— 这段代码还是评论时那样，评论提的问题在当前分支上仍然成立。
 *                  无论是「评论就挂在当前版本上」还是「后来的提交没动到这段」，读者拿到的
 *                  结论完全相同，所以不分两态——分开只会让同一句话有好几种说法
 *   unlocatable —— 这段代码在当前分支上找不到对应位置（方法改名或删除）。
 *                  右侧不给代码——展示一段无关代码比什么都不展示更糟——但要给线索：
 *                  评论之后是谁改过这个文件（DD-43）。
 *
 * now 只在 changed 时有值：它就是「有没有第二份代码可以对照」这件事本身。
 */
export const COMPARE_STATE = {
  changed: "changed",
  unchanged: "unchanged",
  unlocatable: "unlocatable",
};

// path 过滤下返回的就是「动过这个文件」的提交——不是「所有提交」，文案不能说反（DD-49）
const commitsSince = (client, { project, path, targetBranch, since }) =>
  client.get(
    `/projects/${project}/repository/commits` +
      `?path=${encodeURIComponent(path)}` +
      `&ref_name=${encodeURIComponent(targetBranch)}` +
      `&since=${encodeURIComponent(since)}`,
  );

/*
 * diff 的基准固定为两侧的方法体，与「上下各多看几行」无关（DD-42）：
 * 着色是这段代码的客观事实，不该随视口变。op 里带的是文件绝对行号，
 * 渲染时按行号直接对上，省掉一层偏移换算。
 */
function diffOfBase(oldLines, newLines, thenBase, nowBase) {
  const ops = diffLines(
    thenBase.lines.map((line) => line.text),
    nowBase.lines.map((line) => line.text),
  );

  return ops.map((op) => ({
    ...op,
    thenLine: op.thenLine === null ? null : op.thenLine + thenBase.rangeStart - 1,
    nowLine: op.nowLine === null ? null : op.nowLine + nowBase.rangeStart - 1,
  }));
}

export async function buildComparePair(
  client,
  { project, thread, mrHeadSha, targetBranch, extraLines = 0 },
) {
  const oldLines = await loadFile(client, { project, path: thread.path, sha: thread.position.head_sha });
  const sliceOld = (extra) =>
    sliceForReading(oldLines, thread.anchorLine, {
      extraLines: extra,
      sha: thread.position.head_sha,
      path: thread.path,
    });
  const then = sliceOld(extraLines);

  // 三种结局里有两种要它，参数每次都一样
  const touchedSinceComment = () =>
    commitsSince(client, { project, path: thread.path, targetBranch, since: thread.createdAt });

  if (!thread.outdated) {
    return { state: COMPARE_STATE.unchanged, then, now: null, commits: await touchedSinceComment(), diffOps: [] };
  }

  const newLines = await loadFile(client, { project, path: thread.path, sha: mrHeadSha });
  const located = locateInNewVersion({ oldLines, newLines, anchorLine: thread.anchorLine });

  if (!located) {
    // 死胡同要变成线索：评论之后谁改过这个文件。全量给出，显示几条是展示层的事
    const commits = await touchedSinceComment();
    return { state: COMPARE_STATE.unlocatable, then, now: null, commits, diffOps: [] };
  }

  const sliceNew = (extra) =>
    sliceForReading(newLines, located.anchorLine, { extraLines: extra, sha: mrHeadSha, path: thread.path });
  const now = sliceNew(extraLines);
  const diffOps = diffOfBase(oldLines, newLines, sliceOld(0), sliceNew(0));

  /*
   * 「改没改」在这里判一次，界面直接读结论——徽标与代码区的着色、说明行的「N 行有改动」
   * 从此不可能各说一套（DD-45）。
   */
  if (diffOps.some((op) => op.type !== "keep")) {
    return { state: COMPARE_STATE.changed, then, now, commits: [], diffOps };
  }

  // 逐行相同：与「评论就挂在当前版本上」是同一个结论，依据也走同一个查询（DD-49）
  return { state: COMPARE_STATE.unchanged, then, now: null, commits: await touchedSinceComment(), diffOps: [] };
}
