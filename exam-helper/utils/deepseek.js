/**
 * DeepSeek 客户端 DeepSeek（M3-S1，对应验收 V-6、V-7）
 *
 * 纯逻辑：构造请求体 + 解析响应文本为结构化答案。网络请求在 background 执行（TD-4）。
 *
 * UMD 包装（TD-2）：浏览器/service worker 挂全局；Node/Vitest 下 require/import。
 *
 * API：
 *   DeepSeek.API_URL                 端点常量
 *   DeepSeek.buildRequestBody(text)  → { model, messages, temperature }
 *   DeepSeek.parseResponse(json)     → { answer: string[], explain: string }（异常抛错）
 */
(function (global) {
  "use strict";

  const API_URL = "https://api.deepseek.com/chat/completions";

  const SYSTEM_PROMPT =
    "你是《阿里巴巴Java开发手册》编码规范考试助手。用户会给你一道单选或多选题（题干可能含选项）。" +
    "请判断正确答案。只返回一个 JSON 对象，格式严格为 " +
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
    // 优先取“答案”附近的连续字母，否则取全文中的 A-E 序列
    const near = text.match(/答案[^A-E]{0,4}([A-E][A-E\s、,，]*)/);
    const seg = near ? near[1] : text;
    const letters = seg.match(/[A-E]/g) || [];
    return normalizeAnswer(letters);
  }

  function buildRequestBody(text) {
    return {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: String(text == null ? "" : text) },
      ],
      temperature: 0,
    };
  }

  function parseResponse(json) {
    const content =
      json &&
      json.choices &&
      json.choices[0] &&
      json.choices[0].message &&
      json.choices[0].message.content;
    if (!content || typeof content !== "string") {
      throw new Error("DeepSeek 响应为空或结构异常");
    }

    // 去掉可能的 ```json ... ``` 代码围栏
    let body = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();

    // 优先尝试 JSON（截取第一个 { 到最后一个 }）
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

    // 文本兜底
    const answer = extractLettersFromText(content);
    if (!answer.length) {
      throw new Error("无法从 DeepSeek 响应中解析出答案");
    }
    return { answer, explain: content.trim() };
  }

  const DeepSeek = { API_URL, SYSTEM_PROMPT, buildRequestBody, parseResponse };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { DeepSeek };
  } else {
    global.DeepSeek = DeepSeek;
  }
})(typeof self !== "undefined" ? self : this);
