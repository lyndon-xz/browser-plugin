/*
 * 从中文评论正文里认出 Java 标识符，再回代码里找它出现在哪几行。中文字符是天然的分词边界，
 * 所以一条「ASCII 标识符 + 可带 . 链 + 可带括号」的规则就够，不必解析 Java。
 */

// 单个小写词（the、value）不算：要么带点链、要么带括号、要么是大驼峰类名
const CANDIDATE = /[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\([^()\n]*\))?/g;
const HAS_DOT_OR_CALL = /[.(]/;
const TYPE_NAME_PATTERN = /^[A-Z]/;

export function extractIdentifiers(body) {
  const seen = new Set();
  const found = [];

  for (const [candidate] of String(body ?? "").matchAll(CANDIDATE)) {
    const isWorthLinking =
      HAS_DOT_OR_CALL.test(candidate) || TYPE_NAME_PATTERN.test(candidate);
    if (!isWorthLinking || seen.has(candidate)) continue;

    seen.add(candidate);
    found.push({ text: candidate });
  }
  return found;
}

// 去掉调用括号里的实参：评论写 dao.query(sql, hints)，代码里可能是 dao.query(sql, hints, type)
const bareName = (identifier) => identifier.replace(/\(.*$/, "");

export function locateIdentifiers(identifiers, lines) {
  return identifiers.map((text) => ({
    text,
    lines: lines
      .filter((line) => line.text.includes(bareName(text)))
      .map((line) => line.number),
  }));
}
