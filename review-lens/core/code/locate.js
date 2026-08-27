import { findMethodRange } from "./snapshot.js";

/*
 * 把评论时版本的锚点行映射到当前版本的对应位置。不能沿用旧行号：文件改过之后行号会漂移，
 * 同一个行号可能已落到别的方法里。靠方法名定位而不是锚点行文本或整行签名——锚点行往往正是
 * 被改掉的那一行，而整行签名换个参数类型就匹配不上。定位不到返回 null，由调用方告知
 * 「找不到对应位置」，不退回同行号展示一段无关代码。
 */

// 方法名 = 签名里紧挨左括号的那个标识符
const nameOf = (signature) =>
  signature.match(/([A-Za-z_$][\w$]*)\s*\(/)?.[1] ?? null;

function methodStartsNamed(lines, name) {
  const starts = [];
  lines.forEach((line, index) => {
    // 必须是方法起始行，否则同名的调用点也会被算进来
    if (nameOf(line) !== name) {
      return;
    }
    const range = findMethodRange(lines, index + 1);
    if (range?.start === index + 1) {
      starts.push(range.start);
    }
  });
  return starts;
}

export function locateInNewVersion(request) {
  const { oldLines, newLines, anchorLine } = request;

  const oldRange = findMethodRange(oldLines, anchorLine);
  if (!oldRange) {
    return null;
  }

  const name = nameOf(oldLines[oldRange.start - 1]);
  if (!name) {
    return null;
  }

  const candidates = methodStartsNamed(newLines, name);
  if (!candidates.length) {
    return null;
  }

  // 同名方法可能出现多次（重载、复制粘贴），取行号最接近旧位置的那处
  const newStart = candidates.reduce((best, line) =>
    Math.abs(line - oldRange.start) < Math.abs(best - oldRange.start)
      ? line
      : best,
  );

  const newRange = findMethodRange(newLines, newStart);
  const offset = anchorLine - oldRange.start;
  // 新方法可能更短，落到方法体之外就贴到末行
  const end = newRange?.end ?? newLines.length;

  return { anchorLine: Math.min(newStart + offset, end) };
}
