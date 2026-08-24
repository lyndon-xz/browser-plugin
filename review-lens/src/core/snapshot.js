// 锚点行上下各留几行上下文，够看清一处调用的前后即可
export const CONTEXT_LINES = 6;

export function splitLines(text) {
  const lines = text.split(/\r?\n/);
  // 文件通常以换行结尾，split 会多出一个空串，它不是真实的一行
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

export function sliceAround(lines, anchorLine) {
  const rangeStart = Math.max(1, anchorLine - CONTEXT_LINES);
  const rangeEnd = Math.min(lines.length, anchorLine + CONTEXT_LINES);

  return {
    anchorLine,
    rangeStart,
    rangeEnd,
    lines: lines.slice(rangeStart - 1, rangeEnd).map((text, index) => ({
      number: rangeStart + index,
      text,
    })),
  };
}

export async function loadFile(client, { project, path, sha }) {
  const encoded = encodeURIComponent(path);
  const text = await client.getText(
    `/projects/${project}/repository/files/${encoded}/raw?ref=${sha}`,
  );
  return splitLines(text);
}

/*
 * 展示范围：以锚点所在方法为底，再按 extraLines 上下各扩若干行（DD-35）。
 *
 * 之所以不做「片段 / 整段」二态切换：窗口大小与方法边界是两个正交的东西，塞进一个
 * 二态开关就会出现「展开全部反而更少」——方法只有 9 行、而窗口是锚点 ±6 = 13 行。
 * 现在只有一个单调变量 extraLines，点一次范围只会变大。
 */
export const EXTRA_STEP = 10;
const WHOLE_METHOD_LIMIT = 60;

export function sliceForReading(lines, anchorLine, { extraLines = 0, sha, path } = {}) {
  const range = findMethodRange(lines, anchorLine);
  const fits = range && range.end - range.start + 1 <= WHOLE_METHOD_LIMIT;

  // 方法找不到或太长时，底盘退回锚点附近的窗口
  const base = fits ? range : { start: anchorLine - CONTEXT_LINES, end: anchorLine + CONTEXT_LINES };
  const start = Math.max(1, base.start - extraLines);
  const end = Math.min(lines.length, base.end + extraLines);

  return {
    sha,
    path,
    wholeMethod: Boolean(fits),
    methodName: fits ? methodNameAt(lines, range.start) : null,
    anchorLine,
    rangeStart: start,
    rangeEnd: end,
    lines: lines.slice(start - 1, end).map((line, index) => ({
      number: start + index,
      text: line,
    })),
  };
}

const methodNameAt = (lines, start) => lines[start - 1].match(/([A-Za-z_$][\w$]*)\s*\(/)?.[1] ?? null;

export async function loadSnapshot(client, { project, path, sha, anchorLine, extraLines = 0 }) {
  const lines = await loadFile(client, { project, path, sha });
  return sliceForReading(lines, anchorLine, { extraLines, sha, path });
}

/*
 * 去掉字符串字面量、字符字面量与行注释后再数花括号——`log("{ ... }")` 里的花括号
 * 不该参与配平，否则范围会错得离谱。块注释不处理：跨行块注释里放不配对的花括号极少见，
 * 为它引入状态机不值得。
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
    if (char === "{") return depth + 1;
    if (char === "}") return depth - 1;
    return depth;
  }, 0);
};

/*
 * 方法签名：以标识符和括号开头、以 { 结尾的行。
 * 控制语句（if/for/while/switch/catch/synchronized）与类型声明长得一模一样——都是
 * 「标识符 + 括号 + 花括号」，所以必须显式排除，否则「展开完整方法体」会只展开一个 if 块。
 */
const NOT_A_SIGNATURE = /^\s*(?:\}\s*)?(?:else\s+)?(?:if|for|while|switch|catch|synchronized|try|do|class|interface|enum|record)\b/;
const SIGNATURE = /^\s*[\w<>\[\],@.\s]*\([^;]*\)\s*(?:throws[\w\s,.]*)?\{\s*$/;

/*
 * 从锚点行往上找最近的方法签名，再从签名处往下配平花括号找到方法结束。
 * 找不到就返回 null，让界面退回片段视图，而不是给出一个错的范围。
 */
export function findMethodRange(lines, anchorLine) {
  for (let start = anchorLine; start >= 1; start -= 1) {
    const line = lines[start - 1];
    if (NOT_A_SIGNATURE.test(line) || !SIGNATURE.test(line)) continue;

    let depth = 0;
    for (let cursor = start; cursor <= lines.length; cursor += 1) {
      depth += countBraces(lines[cursor - 1]);
      if (depth > 0) continue;
      /*
       * 配平点落在锚点之前，说明这个签名属于更内层或更早的方法（例如锚点正是外层方法的
       * 闭合括号）。继续往上找外层签名，而不是就此放弃。
       */
      if (cursor >= anchorLine) return { start, end: cursor };
      break;
    }
  }
  return null;
}
