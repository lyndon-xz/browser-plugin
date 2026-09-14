/**
 * DeepSeek 请求体构造与响应解析。实际 fetch 在 background 执行，规避宿主页 CSP。
 */

const API_URL = "https://api.deepseek.com/chat/completions";

const SYSTEM_PROMPT =
  "你是选择题答题助手。用户会给你一道单选或多选题（题干可能含选项）。" +
  "请根据题目内容和选项判断正确答案。只返回一个 JSON 对象，格式严格为 " +
  '{"answer":["A","C"],"explain":"简短解析"}，' +
  "answer 为正确选项的大写字母数组，explain 为一句话解析。不要输出 JSON 以外的任何内容。";

/** 规整答案字母：大写、过滤非 A-E、去重、排序。 */
function normalizeAnswer(arr) {
  const seen = new Set();
  for (const x of arr) {
    const c = String(x).trim().toUpperCase();
    if (/^[A-E]$/.test(c)) seen.add(c);
  }
  return [...seen].sort();
}

/** 从任意文本中兜底提取答案字母（如“正确答案：BCD”）。 */
function extractLettersFromText(text) {
  const near = text.match(/答案[^A-E]{0,4}([A-E][A-E\s、,，]*)/);
  const seg = near ? near[1] : text;
  const letters = seg.match(/[A-E]/g) || [];
  return normalizeAnswer(letters);
}

export function buildRequestBody(text) {
  return {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: String(text == null ? "" : text) },
    ],
    temperature: 0,
  };
}

export function parseResponse(json) {
  const content =
    json &&
    json.choices &&
    json.choices[0] &&
    json.choices[0].message &&
    json.choices[0].message.content;
  if (!content || typeof content !== "string") {
    throw new Error("DeepSeek 响应为空或结构异常");
  }

  let body = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();

  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(body.slice(start, end + 1));
      const answer = normalizeAnswer(
        Array.isArray(obj.answer) ? obj.answer : [],
      );
      if (answer.length) {
        return { answer, explain: obj.explain ? String(obj.explain) : "" };
      }
    } catch (e) {
      /* 落到文本兜底 */
    }
  }

  const answer = extractLettersFromText(content);
  if (!answer.length) {
    throw new Error("无法从 DeepSeek 响应中解析出答案");
  }
  return { answer, explain: content.trim() };
}

export const DeepSeek = {
  API_URL,
  SYSTEM_PROMPT,
  buildRequestBody,
  parseResponse,
};
