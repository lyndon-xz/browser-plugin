/*
 * 基于参考材料片段让 DeepSeek 生成选择题（background 侧解析）。
 */

const GENERATE_SYSTEM =
  "你是选择题命题助手。用户会提供一段参考材料（文档、规约、讲义等），" +
  "请严格依据材料内容出题，不得编造材料中没有的信息。" +
  "只返回 JSON 数组，不要输出其它文字。每题格式：" +
  '{"type":"single"|"multi","title":"题干","options":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}],"answer":["B"],"explain":"一句话解析"}';

function normalizeAnswer(arr) {
  const seen = new Set();
  for (const x of arr || []) {
    const c = String(x).trim().toUpperCase();
    if (/^[A-D]$/.test(c)) {
      seen.add(c);
    }
  }
  return [...seen].sort();
}

function normalizeOptions(rawOptions) {
  const keys = ["A", "B", "C", "D"];
  if (!Array.isArray(rawOptions)) {
    return null;
  }
  const options = keys.map((key, index) => {
    const item = rawOptions[index];
    const text =
      typeof item === "string"
        ? item
        : String(item?.text ?? item?.label ?? "").trim();
    if (!text) {
      return null;
    }
    return { key, text };
  });
  return options.every(Boolean) ? options : null;
}

export function normalizeGeneratedQuestion(raw, id) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const title = String(raw.title ?? "").trim();
  const options = normalizeOptions(raw.options);
  const answer = normalizeAnswer(raw.answer);
  if (!title || !options || !answer.length) {
    return null;
  }

  let type = raw.type === "multi" || raw.type === "single" ? raw.type : null;
  if (!type) {
    type = answer.length > 1 ? "multi" : "single";
  }
  if (type === "single" && answer.length > 1) {
    type = "multi";
  }

  return {
    id,
    type,
    title,
    options,
    answer,
    explain: String(raw.explain ?? "").trim(),
    source: "ai-material",
  };
}

export function buildGenerateRequestBody(excerpt, count = 2, options = {}) {
  const n = Math.max(1, Math.min(3, count));
  const reuse = !!options.reuse;
  const variantHint = reuse
    ? "该片段之前已出过题，请换角度、换场景、换干扰项，避免与常见考法重复。"
    : "";
  return {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: GENERATE_SYSTEM },
      {
        role: "user",
        content:
          `根据以下参考材料，出 ${n} 道单选或多选题（4 个选项 A-D，干扰项合理）。${variantHint}\n\n` +
          String(excerpt ?? "").slice(0, 1200),
      },
    ],
    temperature: reuse ? 0.55 : 0.2,
  };
}

export function parseGeneratedQuestions(json, idPrefix) {
  const content =
    json?.choices?.[0]?.message?.content &&
    String(json.choices[0].message.content);
  if (!content) {
    throw new Error("AI 出题响应为空");
  }

  let body = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();

  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start === -1 || end <= start) {
    throw new Error("AI 出题响应不是 JSON 数组");
  }

  let list;
  try {
    list = JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new Error("AI 出题 JSON 解析失败");
  }

  if (!Array.isArray(list)) {
    throw new Error("AI 出题响应格式异常");
  }

  const questions = [];
  list.forEach((item, index) => {
    const id = `${idPrefix}-${index}`;
    const question = normalizeGeneratedQuestion(item, id);
    if (question) {
      questions.push(question);
    }
  });

  if (!questions.length) {
    throw new Error("AI 未能生成有效题目");
  }
  return questions;
}
