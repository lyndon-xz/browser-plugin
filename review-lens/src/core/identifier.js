/*
 * 从中文评论正文里认出 Java 标识符，再回代码里找它出现在哪几行。
 * 中文字符是天然的分词边界，所以只需要一条「ASCII 标识符 + 可带 . 链 + 可带括号」的规则，
 * 不必真的解析 Java。
 */

// 单个小写词（the、value）不算：要么带点链、要么带括号、要么是大驼峰类名
const CANDIDATE = /[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\([^()\n]*\))?/g;
const HAS_DOT_OR_CALL = /[.(]/;
const IS_TYPE_NAME = /^[A-Z]/;

export function extractIdentifiers(body) {
  const seen = new Set();
  const found = [];

  for (const [candidate] of String(body ?? "").matchAll(CANDIDATE)) {
    const worthIt = HAS_DOT_OR_CALL.test(candidate) || IS_TYPE_NAME.test(candidate);
    if (!worthIt || seen.has(candidate)) continue;

    seen.add(candidate);
    found.push({ text: candidate });
  }
  return found;
}

/*
 * 找命中行时去掉调用括号里的实参：评论里写 dao.query(sql, hints)，
 * 代码里往往是 dao.query(sql, hints, type) 之类，按裸名匹配才找得到。
 */
const bareName = (identifier) => identifier.replace(/\(.*$/, "");

export function locateIdentifiers(identifiers, lines) {
  return identifiers.map((text) => ({
    text,
    lines: lines.filter((line) => line.text.includes(bareName(text))).map((line) => line.number),
  }));
}
