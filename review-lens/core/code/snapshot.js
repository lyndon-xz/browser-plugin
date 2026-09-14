// 锚点行上下各留几行上下文，够看清一处调用的前后即可
const CONTEXT_LINES = 6;

/*
 * 展示范围以锚点所在方法为底，再按 extraLines 上下各扩若干行。不做「片段 / 整段」二态切换：
 * 窗口大小与方法边界正交，二态开关会出现「展开全部反而更少」——9 行的方法比锚点 ±6 更窄。
 * 长方法的展示窗口可以收缩；三态与着色另走 sliceForDiff，始终用完整方法体。
 */
const WHOLE_METHOD_LIMIT = 60;

// 方法名 = 签名里紧挨左括号的那个标识符。定位与切片共用这一份。
const METHOD_NAME = /([A-Za-z_$][\w$]*)\s*\(/;

const methodNameOf = (signature) => signature.match(METHOD_NAME)?.[1] ?? null;

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
// 单行签名：修饰符、参数与左花括号在同一行
const SIGNATURE = /^\s*[\w<>[\],@.\s]*\([^;]*\)\s*(?:throws[\w\s,.]*)?\{\s*$/;
// 多行签名：参数换行后，右括号与左花括号落在同一行
const SIGNATURE_MULTILINE =
  /^\s*[\w<>[\],@.\s]*\)\s*(?:throws[\w\s,.]*)?\{\s*$/;

/** 判断一行是否像 Java 方法签名行 */
export function isMethodSignature(line) {
  if (NOT_A_SIGNATURE.test(line)) {
    return false;
  }
  return SIGNATURE.test(line) || SIGNATURE_MULTILINE.test(line);
}

/** 方法名可能在签名第一行，多行签名时要往上找带 `foo(` 的那一行 */
export function methodNameAt(lines, signatureLine) {
  for (let line = signatureLine; line >= 1; line -= 1) {
    const name = methodNameOf(lines[line - 1]);
    if (name) {
      return name;
    }
    // 往上扫到修饰符行就停，避免误扫进上一个方法体
    if (
      /^\s*(?:public|private|protected|static|final|synchronized)\b/.test(
        lines[line - 1],
      )
    ) {
      break;
    }
  }
  return null;
}

/**
 * 从锚点行往上找最近的方法签名，再从签名处往下配平花括号找到方法结束。
 * 找不到就返回 null，让界面退回片段视图，而不是给出一个错的范围。
 */
export function findMethodRange(lines, anchorLine) {
  for (let start = anchorLine; start >= 1; start -= 1) {
    const line = lines[start - 1];
    if (!isMethodSignature(line)) {
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

function toSlice(lines, range, extra) {
  const { start, end } = range;
  const { extraLines = 0, path, isWholeMethod, methodName, anchorLine } = extra;
  const rangeStart = Math.max(1, start - extraLines);
  const rangeEnd = Math.min(lines.length, end + extraLines);

  return {
    path,
    isWholeMethod,
    methodName,
    anchorLine,
    rangeStart,
    rangeEnd,
    lines: lines.slice(rangeStart - 1, rangeEnd).map((line, index) => ({
      number: rangeStart + index,
      text: line,
    })),
  };
}

function methodWindow(lines, anchorLine) {
  if (!(anchorLine >= 1 && anchorLine <= lines.length)) {
    return null;
  }

  const range = findMethodRange(lines, anchorLine);
  const methodName = range ? methodNameAt(lines, range.start) : null;
  return { range, methodName, anchorLine };
}

/**
 * 三态与着色的基准：完整方法体。找不到方法时退回锚点附近，与展示层同一退路。
 */
export function sliceForDiff(lines, anchorLine, options = {}) {
  const { path } = options;
  const window = methodWindow(lines, anchorLine);
  if (!window) {
    return null;
  }

  const { range, methodName } = window;
  const base = range ?? {
    start: anchorLine - CONTEXT_LINES,
    end: anchorLine + CONTEXT_LINES,
  };

  return toSlice(lines, base, {
    extraLines: 0,
    path,
    isWholeMethod: Boolean(range),
    methodName,
    anchorLine,
  });
}

/** 展示用代码片段：锚点附近或整段方法，可额外上下扩行 */
export function sliceForReading(lines, anchorLine, options = {}) {
  const { extraLines = 0, path } = options;
  const window = methodWindow(lines, anchorLine);
  if (!window) {
    return null;
  }

  const { range, methodName } = window;
  const isWithinWholeMethodLimit =
    range && range.end - range.start + 1 <= WHOLE_METHOD_LIMIT;
  const base = isWithinWholeMethodLimit
    ? range
    : { start: anchorLine - CONTEXT_LINES, end: anchorLine + CONTEXT_LINES };

  return toSlice(lines, base, {
    extraLines,
    path,
    isWholeMethod: Boolean(isWithinWholeMethodLimit),
    methodName: isWithinWholeMethodLimit ? methodName : null,
    anchorLine,
  });
}
