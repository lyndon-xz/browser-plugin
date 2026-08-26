/*
 * 逐行切 Java token 供代码栏着色，不做真正的语法分析：读评审只需要关键字/字符串/注释/数字/类型
 * 这五类的区分度。输出 token 数组而不是 HTML 字符串，渲染侧才能一律用 textContent 写入。
 */

const KEYWORDS = new Set([
  "abstract",
  "assert",
  "boolean",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "class",
  "const",
  "continue",
  "default",
  "do",
  "double",
  "else",
  "enum",
  "extends",
  "final",
  "finally",
  "float",
  "for",
  "goto",
  "if",
  "implements",
  "import",
  "instanceof",
  "int",
  "interface",
  "long",
  "native",
  "new",
  "package",
  "private",
  "protected",
  "public",
  "record",
  "return",
  "short",
  "static",
  "strictfp",
  "super",
  "switch",
  "synchronized",
  "this",
  "throw",
  "throws",
  "transient",
  "try",
  "var",
  "void",
  "volatile",
  "while",
  "true",
  "false",
  "null",
]);

// 顺序即优先级：注释先于一切，字符串先于标识符，否则字符串里的 return 会被当关键字
const RULES = [
  { kind: "comment", pattern: /^\/\/.*/ },
  { kind: "comment", pattern: /^\/\*.*?(?:\*\/|$)/ },
  { kind: "string", pattern: /^"(?:[^"\\]|\\.)*"?/ },
  { kind: "string", pattern: /^'(?:[^'\\]|\\.)*'?/ },
  { kind: "number", pattern: /^\d[\w.]*/ },
  { kind: "word", pattern: /^[A-Za-z_$][\w$]*/ },
  { kind: "plain", pattern: /^[^\w$"'/]+|^\// },
];

export function tokenizeJava(line) {
  const tokens = [];
  let rest = String(line ?? "");

  while (rest) {
    const hit = RULES.map((rule) => ({
      rule,
      match: rest.match(rule.pattern),
    })).find((candidate) => candidate.match);
    // 兜底：认不出的字符单独吐出去，保证不丢字符、也不空转
    const text = hit?.match[0] || rest[0];
    const kind = hit?.rule.kind ?? "plain";

    tokens.push({
      kind: kind === "word" ? wordKind(text) : kind,
      text,
    });
    rest = rest.slice(text.length);
  }

  return tokens;
}

// 大写开头视作类型名：Java 的命名约定足够可靠，不必解析导入
const wordKind = (word) => {
  if (KEYWORDS.has(word)) return "keyword";
  return /^[A-Z]/.test(word) ? "type" : "plain";
};
