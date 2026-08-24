/*
 * 行级差异：标准 LCS 动态规划 + 回溯。
 * 只做行级、不做行内字符级——本产品要回答的是「哪几行变了」，字符级高亮只会加噪声。
 * 行文本严格相等比较，所以缩进变化也算改动：Java 里缩进变了通常意味着结构变了。
 */

function longestCommonLengths(then, now) {
  // lengths[i][j] = then[i..] 与 now[j..] 的最长公共子序列长度
  const lengths = Array.from({ length: then.length + 1 }, () => new Uint32Array(now.length + 1));

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
  const lengths = longestCommonLengths(thenLines, nowLines);
  const ops = [];

  let i = 0;
  let j = 0;
  while (i < thenLines.length && j < nowLines.length) {
    if (thenLines[i] === nowLines[j]) {
      ops.push({ type: "keep", text: thenLines[i], thenLine: i + 1, nowLine: j + 1 });
      i += 1;
      j += 1;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      ops.push({ type: "remove", text: thenLines[i], thenLine: i + 1, nowLine: null });
      i += 1;
    } else {
      ops.push({ type: "add", text: nowLines[j], thenLine: null, nowLine: j + 1 });
      j += 1;
    }
  }

  // 一侧走完，另一侧剩下的全是纯增或纯删
  for (; i < thenLines.length; i += 1) {
    ops.push({ type: "remove", text: thenLines[i], thenLine: i + 1, nowLine: null });
  }
  for (; j < nowLines.length; j += 1) {
    ops.push({ type: "add", text: nowLines[j], thenLine: null, nowLine: j + 1 });
  }

  return ops;
}
