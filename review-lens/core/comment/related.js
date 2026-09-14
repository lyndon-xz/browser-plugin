import {
  dropPrefixIdentifiers,
  extractIdentifiers,
  isBoilerplateLine,
  locateIdentifiers,
} from "./identifier.js";

// 自动扩行上限：只为把离锚点最近的一处标识符纳入当前片段，不扫整文件
const MAX_AUTO_EXTRA = 40;

/**
 * 评论里的标识符若落在当前可见片段外，算出把「离锚点最近那一处」纳入片段所需的最小 extraLines。
 * 列表仍只在可见片段里列，避免整文件搜索拉出几十个 distant 命中。
 */
export function minimalExtraForRelatedHit(request) {
  const { fileLines, then, body } = request;
  if (!then || !fileLines?.length) {
    return 0;
  }

  const numbered = fileLines.map((text, index) => ({
    number: index + 1,
    text,
  }));
  const { anchorLine, rangeStart, rangeEnd } = then;
  const identifiers = dropPrefixIdentifiers(
    extractIdentifiers(body).map((item) => item.text),
  );
  if (!identifiers.length) {
    return 0;
  }

  const located = locateIdentifiers(identifiers, numbered);
  const hitLines = [];
  for (const { lines: matches } of located) {
    for (const line of matches) {
      if (line === anchorLine) {
        continue;
      }
      if (isBoilerplateLine(numbered[line - 1]?.text)) {
        continue;
      }
      hitLines.push(line);
    }
  }
  if (!hitLines.length) {
    return 0;
  }

  const nearest = hitLines.sort(
    (a, b) => Math.abs(a - anchorLine) - Math.abs(b - anchorLine),
  )[0];
  if (nearest >= rangeStart && nearest <= rangeEnd) {
    return 0;
  }
  if (nearest < rangeStart) {
    return Math.min(rangeStart - nearest, MAX_AUTO_EXTRA);
  }
  return Math.min(nearest - rangeEnd, MAX_AUTO_EXTRA);
}

/**
 * 评论常常挂在问题代码的上一行或下一行（GitLab 只能锚到 diff 里的某一行），
 * 所以据评论正文里的标识符回代码里找「它到底在说哪几行」，并说清命中依据。
 */
export function relatedLines(request) {
  const { body, lines, anchorLine } = request;

  const identifiers = dropPrefixIdentifiers(
    extractIdentifiers(body).map((item) => item.text),
  );
  const located = locateIdentifiers(identifiers, lines);
  const lineTextOf = (number) =>
    lines.find((line) => line.number === number)?.text ?? "";

  // 一行可能命中多个标识符，命中越多越可能是评论真正指的行
  const hitsByLine = new Map();
  for (const { text, lines: hitLines } of located) {
    for (const number of hitLines) {
      if (isBoilerplateLine(lineTextOf(number))) {
        continue;
      }
      if (!hitsByLine.has(number)) {
        hitsByLine.set(number, []);
      }
      hitsByLine.get(number).push(text);
    }
  }
  if (anchorLine != null) {
    hitsByLine.set(anchorLine, hitsByLine.get(anchorLine) ?? []);
  }

  const candidates = [...hitsByLine.entries()]
    .map((entry) => {
      const [line, hits] = entry;

      return {
        line,
        hitCount: hits.length,
        reason:
          line === anchorLine
            ? `评论锚定的行${hits.length ? `，也出现了 ${hits.join("、")}` : ""}`
            : `评论里的 ${hits.join("、")} 在此处出现`,
      };
    })
    .sort((a, b) => b.hitCount - a.hitCount || a.line - b.line)
    .map((candidate) => {
      const { line, reason } = candidate;
      return { line, reason };
    });

  // 只有锚点一个候选时不值得弹一个列表出来
  return candidates.length > 1 ? candidates : [];
}
