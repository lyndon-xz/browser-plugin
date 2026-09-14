/*
 * 从中文评论正文里认出 Java 标识符，再回代码里找它出现在哪几行。中文字符是天然的分词边界，
 * 所以一条「ASCII 标识符 + 可带 . 链 + 可带括号」的规则就够，不必解析 Java。
 */

// 单个小写词（the、value）不算：要么带点链、要么带括号、要么是大驼峰类名
const CANDIDATE = /[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\([^()\n]*\))?/g;
const HAS_DOT_OR_CALL = /[.(]/;
const TYPE_NAME_PATTERN = /^[A-Z]/;

const isTrivialWord = (candidate) =>
  !HAS_DOT_OR_CALL.test(candidate) && !TYPE_NAME_PATTERN.test(candidate);

/** import / package 行：类名会出现，但不是评论在说的调用点 */
export function isBoilerplateLine(text) {
  const trimmed = String(text ?? "").trim();
  return /^(import|package)\s/.test(trimmed);
}

/** 评论里同时出现 ReTryService 与 ReTryService.doIoService 时，只保留更具体的那条 */
export function dropPrefixIdentifiers(identifiers) {
  return identifiers.filter(
    (id) =>
      !identifiers.some((other) => other !== id && other.startsWith(`${id}.`)),
  );
}

/** 从评论正文提取可能指向代码的标识符 */
export function extractIdentifiers(body) {
  const seen = new Set();
  const found = [];

  for (const [candidate] of String(body ?? "").matchAll(CANDIDATE)) {
    if (isTrivialWord(candidate) || seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    found.push({ text: candidate });
  }
  return found;
}

// 去掉调用括号里的实参：评论写 dao.query(sql, hints)，代码里可能是 dao.query(sql, hints, type)
const bareName = (identifier) => identifier.replace(/\(.*$/, "");

/** 在代码行里查找标识符出现的位置 */
export function locateIdentifiers(identifiers, lines) {
  return identifiers.map((text) => {
    const full = bareName(text);
    let hitLines = lines
      .filter((line) => line.text.includes(full))
      .map((line) => line.number);

    if (!hitLines.length) {
      const dotted = full.match(/(\.[A-Za-z_$][\w$]*)$/)?.[1];
      if (dotted && dotted.length > 1) {
        hitLines = lines
          .filter((line) => line.text.includes(dotted))
          .map((line) => line.number);
      }
    }

    return { text, lines: hitLines };
  });
}

/** 标识符命中多行时取离 GitLab 锚点最近的那一行 */
export function pickJumpLine(hitLines, anchorLine) {
  if (!hitLines?.length) {
    return null;
  }
  if (hitLines.length === 1 || anchorLine == null) {
    return hitLines[0];
  }
  return [...hitLines].sort(
    (a, b) => Math.abs(a - anchorLine) - Math.abs(b - anchorLine),
  )[0];
}
