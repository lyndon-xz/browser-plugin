import { isJavaLikePath } from "./language.js";
import {
  findMethodRange,
  isMethodSignature,
  methodNameAt,
} from "./snapshot.js";

/*
 * 把评论时版本的锚点行映射到当前版本的对应位置。不能沿用旧行号：文件改过之后行号会漂移，
 * 同一个行号可能已落到别的方法里。首选方法名映射；方法改名、签名换行或格式化导致匹配失败时，
 * 再回退到锚点行全文匹配——评论行往往足够独特，且比「代码已删除」更符合读者预期。
 */

// 过短的行（大括号、return 等）全文匹配误报太多
const MIN_LINE_TEXT_LEN = 6;

function methodStartsNamed(lines, name) {
  const starts = [];
  lines.forEach((line, index) => {
    const lineNo = index + 1;
    if (!isMethodSignature(line)) {
      return;
    }
    if (methodNameAt(lines, lineNo) !== name) {
      return;
    }
    const range = findMethodRange(lines, lineNo);
    if (range?.start === lineNo) {
      starts.push(lineNo);
    }
  });
  return starts;
}

function locateByLineText(oldLines, newLines, anchorLine) {
  const raw = oldLines[anchorLine - 1];
  if (raw == null) {
    return null;
  }

  const needle = raw.trim();
  if (needle.length < MIN_LINE_TEXT_LEN) {
    return null;
  }

  const hits = [];
  for (let index = 0; index < newLines.length; index += 1) {
    if (newLines[index].trim() === needle) {
      hits.push(index + 1);
    }
  }

  if (!hits.length) {
    return null;
  }

  // 同名行多处出现时，取行号最接近评论时位置的那一处
  const anchorLineInNew = hits.reduce((best, line) =>
    Math.abs(line - anchorLine) < Math.abs(best - anchorLine) ? line : best,
  );

  return { anchorLine: anchorLineInNew };
}

function locateByMethodName(oldLines, newLines, anchorLine) {
  const oldRange = findMethodRange(oldLines, anchorLine);
  if (!oldRange) {
    return null;
  }

  const { start } = oldRange;
  const name = methodNameAt(oldLines, start);
  if (!name) {
    return null;
  }

  const candidates = methodStartsNamed(newLines, name);
  if (!candidates.length) {
    return null;
  }

  // 同名方法可能出现多次（重载、复制粘贴），取行号最接近旧位置的那处
  const newStart = candidates.reduce((best, line) =>
    Math.abs(line - start) < Math.abs(best - start) ? line : best,
  );

  const newRange = findMethodRange(newLines, newStart);
  const offset = anchorLine - start;
  // 新方法可能更短，落到方法体之外就贴到末行
  const end = newRange?.end ?? newLines.length;

  return { anchorLine: Math.min(newStart + offset, end) };
}

/** 在 MR 当前 head 版本里定位评论锚点对应的方法/行 */
export function locateInNewVersion(request) {
  const { oldLines, newLines, anchorLine, path } = request;

  if (isJavaLikePath(path)) {
    return (
      locateByMethodName(oldLines, newLines, anchorLine) ??
      locateByLineText(oldLines, newLines, anchorLine)
    );
  }
  return locateByLineText(oldLines, newLines, anchorLine);
}
