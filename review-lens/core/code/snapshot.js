// 锚点行上下各留几行上下文，够看清一处调用的前后即可
const CONTEXT_LINES = 6;

/*
 * 展示范围以锚点所在方法为底，再按 extraLines 上下各扩若干行。不做「片段 / 整段」二态切换：
 * 窗口大小与方法边界正交，二态开关会出现「展开全部反而更少」——9 行的方法比锚点 ±6 更窄。
 */
const WHOLE_METHOD_LIMIT = 60;

export function sliceForReading(lines, anchorLine, options = {}) {
  const { extraLines = 0, sha, path } = options;

  // 旧行号在 force push 或文件被截短后会越界，硬算下去会产出 rangeStart > rangeEnd 的空区间
  if (!(anchorLine >= 1 && anchorLine <= lines.length)) {
    return null;
  }

  const range = findMethodRange(lines, anchorLine);
  const isWithinWholeMethodLimit = range && range.end - range.start + 1 <= WHOLE_METHOD_LIMIT;

  // 方法找不到或太长时，底盘退回锚点附近的窗口
  const base = isWithinWholeMethodLimit
    ? range
    : { start: anchorLine - CONTEXT_LINES, end: anchorLine + CONTEXT_LINES };
  const start = Math.max(1, base.start - extraLines);
  const end = Math.min(lines.length, base.end + extraLines);

  return {
    sha,
    path,
    isWholeMethod: Boolean(isWithinWholeMethodLimit),
    methodName: isWithinWholeMethodLimit ? methodNameAt(lines, range.start) : null,
    anchorLine,
    rangeStart: start,
    rangeEnd: end,
    lines: lines.slice(start - 1, end).map((line, index) => ({
      number: start + index,
      text: line,
    })),
  };
}

const methodNameAt = (lines, start) =>
  lines[start - 1].match(/([A-Za-z_$][\w$]*)\s*\(/)?.[1] ?? null;

/*
 * 数花括号前先去掉字符串、字符字面量与行注释：`log("{ ... }")` 里的花括号不该参与配平。
 * 块注释不处理，跨行块注释里放不配对的花括号极少见，为它引入状态机不值得。
 */
const codeOnly = (line) =>
  line
    .replace(/\\./g, "")
    .replace(/"[^"]*"/g, '""')
    .replace(/'[^']*'/g, "''")
    .replace(/\/\/.*$/, "");

const countBraces = (line) => {
  const code = codeOnly(line);
  return [...code].reduce((depth, char) => {
    if (char === "{") {
      return depth + 1;
    }
    if (char === "}") {
      return depth - 1;
    }
    return depth;
  }, 0);
};

/*
 * 方法签名：以标识符和括号开头、以 { 结尾的行。控制语句与类型声明也是「标识符 + 括号 + 花括号」，
 * 必须显式排除，否则「展开完整方法体」会只展开一个 if 块。
 */
const NOT_A_SIGNATURE =
  /^\s*(?:}\s*)?(?:else\s+)?(?:if|for|while|switch|catch|synchronized|try|do|class|interface|enum|record)\b/;
const SIGNATURE = /^\s*[\w<>[\],@.\s]*\([^;]*\)\s*(?:throws[\w\s,.]*)?\{\s*$/;

/**
 * 从锚点行往上找最近的方法签名，再从签名处往下配平花括号找到方法结束。
 * 找不到就返回 null，让界面退回片段视图，而不是给出一个错的范围。
 */
export function findMethodRange(lines, anchorLine) {
  for (let start = anchorLine; start >= 1; start -= 1) {
    const line = lines[start - 1];
    if (NOT_A_SIGNATURE.test(line) || !SIGNATURE.test(line)) {
      continue;
    }

    let depth = 0;
    for (let cursor = start; cursor <= lines.length; cursor += 1) {
      depth += countBraces(lines[cursor - 1]);
      if (depth > 0) {
        continue;
      }
      // 配平点落在锚点之前说明这个签名属于更早的方法，继续往上找外层签名
      if (cursor >= anchorLine) {
        return { start, end: cursor };
      }
      break;
    }
  }
  return null;
}
