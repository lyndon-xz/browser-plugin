/*
 * 行级差异：LCS 动态规划 + 回溯。只做行级不做字符级，要回答的是「哪几行变了」。
 * 行文本按严格相等比较，所以缩进变化也算改动：Java 里缩进变了通常意味着结构变了。
 */

// 超大方法体的 LCS 网格会 O(n×m) 占内存，截断后仍够看出「改没改」
const MAX_DIFF_LINES = 500;

function longestCommonLengths(then, now) {
  // lengths[i][j] = then[i..] 与 now[j..] 的最长公共子序列长度
  const lengths = Array.from(
    { length: then.length + 1 },
    () => new Uint32Array(now.length + 1),
  );

  for (let i = then.length - 1; i >= 0; i -= 1) {
    for (let j = now.length - 1; j >= 0; j -= 1) {
      lengths[i][j] =
        then[i] === now[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  return lengths;
}

export function diffLines(thenLines, nowLines) {
  const then = thenLines.slice(0, MAX_DIFF_LINES);
  const now = nowLines.slice(0, MAX_DIFF_LINES);
  const lengths = longestCommonLengths(then, now);
  const ops = [];

  let i = 0;
  let j = 0;
  while (i < then.length && j < now.length) {
    if (then[i] === now[j]) {
      ops.push({
        type: "keep",
        thenLine: i + 1,
        nowLine: j + 1,
      });
      i += 1;
      j += 1;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      ops.push({
        type: "remove",
        thenLine: i + 1,
        nowLine: null,
      });
      i += 1;
    } else {
      ops.push({
        type: "add",
        thenLine: null,
        nowLine: j + 1,
      });
      j += 1;
    }
  }

  // 一侧走完，另一侧剩下的全是纯增或纯删
  for (; i < then.length; i += 1) {
    ops.push({
      type: "remove",
      thenLine: i + 1,
      nowLine: null,
    });
  }
  for (; j < now.length; j += 1) {
    ops.push({
      type: "add",
      thenLine: null,
      nowLine: j + 1,
    });
  }

  return ops;
}
