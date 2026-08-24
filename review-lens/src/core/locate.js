import { findMethodRange } from "./snapshot.js";

/*
 * 把评论时版本的锚点行，映射到当前版本的对应位置。
 *
 * 不能沿用旧行号：文件改过之后行号会漂移，真机上评论锚在旧版第 32 行，当前版第 32 行
 * 已经落到了别的方法里，于是「修正后」一侧展示了完全不相干的代码。
 *
 * 靠方法名定位而不是靠整行签名或锚点行文本：
 * - 锚点行本身往往正是被改掉的那一行（timeout(60 * 3) → timeout(30)），拿它去搜必然搜不到；
 * - 整行签名太脆，参数类型换一下就匹配不上（真机上就是这么失败的）。
 *
 * 定位不到就返回 null——让调用方明确告知「找不到对应位置」，绝不退回同行号，
 * 那会展示一段无关代码，比什么都不展示更糟（DD-34）。
 */

// 方法名 = 签名里紧挨左括号的那个标识符
const nameOf = (signature) => signature.match(/([A-Za-z_$][\w$]*)\s*\(/)?.[1] ?? null;

function methodStartsNamed(lines, name) {
  const starts = [];
  lines.forEach((line, index) => {
    // 必须是方法起始行，否则同名的调用点也会被算进来
    if (nameOf(line) !== name) return;
    const range = findMethodRange(lines, index + 1);
    if (range?.start === index + 1) starts.push(range.start);
  });
  return starts;
}

export function locateInNewVersion({ oldLines, newLines, anchorLine }) {
  const oldRange = findMethodRange(oldLines, anchorLine);
  if (!oldRange) return null;

  const name = nameOf(oldLines[oldRange.start - 1]);
  if (!name) return null;

  const candidates = methodStartsNamed(newLines, name);
  if (!candidates.length) return null;

  // 同名方法可能出现多次（重载、复制粘贴），取行号最接近旧位置的那处
  const newStart = candidates.reduce((best, line) =>
    Math.abs(line - oldRange.start) < Math.abs(best - oldRange.start) ? line : best,
  );

  const newRange = findMethodRange(newLines, newStart);
  const offset = anchorLine - oldRange.start;
  // 新方法可能更短，落到方法体之外就贴到末行
  const end = newRange?.end ?? newLines.length;

  return { anchorLine: Math.min(newStart + offset, end) };
}
