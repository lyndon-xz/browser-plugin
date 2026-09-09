import { extractIdentifiers, locateIdentifiers } from "./identifier.js";

/**
 * 评论常常挂在问题代码的上一行或下一行（GitLab 只能锚到 diff 里的某一行），
 * 所以据评论正文里的标识符回代码里找「它到底在说哪几行」，并说清命中依据。
 */
export function relatedLines(request) {
  const { body, lines, anchorLine } = request;

  const identifiers = extractIdentifiers(body).map((item) => item.text);
  const located = locateIdentifiers(identifiers, lines);

  // 一行可能命中多个标识符，命中越多越可能是评论真正指的行
  const hitsByLine = new Map();
  for (const { text, lines: hitLines } of located) {
    for (const number of hitLines) {
      if (!hitsByLine.has(number)) {
        hitsByLine.set(number, []);
      }
      hitsByLine.get(number).push(text);
    }
  }
  hitsByLine.set(anchorLine, hitsByLine.get(anchorLine) ?? []);

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
