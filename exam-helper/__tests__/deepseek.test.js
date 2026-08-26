import { describe, it, expect } from "vitest";
import { DeepSeek } from "../utils/deepseek.js";

/**
 * M3-S1 DeepSeek 客户端纯逻辑测试（对应验收 V-6、V-7）
 * 覆盖：请求体构造、响应解析（JSON / 代码围栏 / 纯文本兜底）、异常抛出。
 */

describe("DeepSeek.buildRequestBody 请求体构造", () => {
  it("生成 model=deepseek-chat、temperature=0、含 system+user 两条消息", () => {
    const body = DeepSeek.buildRequestBody("某道题目文本");
    expect(body.model).toBe("deepseek-chat");
    expect(body.temperature).toBe(0);
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages.length).toBe(2);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
    expect(body.messages[1].content).toBe("某道题目文本");
  });

  it("system 提示要求返回可解析的答案结构", () => {
    const body = DeepSeek.buildRequestBody("x");
    expect(body.messages[0].content).toMatch(/answer/i);
  });
});

function wrap(content) {
  return { choices: [{ message: { content } }] };
}

describe("DeepSeek.parseResponse 响应解析", () => {
  it("解析纯 JSON 内容为 {answer, explain}", () => {
    const r = DeepSeek.parseResponse(
      wrap('{"answer":["A","C"],"explain":"因为如此"}'),
    );
    expect(r.answer).toEqual(["A", "C"]);
    expect(r.explain).toBe("因为如此");
  });

  it("解析被 ```json 代码围栏包裹的内容", () => {
    const content = "```json\n{\"answer\":[\"B\"],\"explain\":\"单选\"}\n```";
    const r = DeepSeek.parseResponse(wrap(content));
    expect(r.answer).toEqual(["B"]);
  });

  it("答案字母大写并去重排序，过滤非 A-E", () => {
    const r = DeepSeek.parseResponse(wrap('{"answer":["c","a","c","x"],"explain":""}'));
    expect(r.answer).toEqual(["A", "C"]);
  });

  it("JSON 解析失败时从文本兜底提取答案字母", () => {
    const r = DeepSeek.parseResponse(wrap("正确答案：BCD。因为……"));
    expect(r.answer).toEqual(["B", "C", "D"]);
    expect(typeof r.explain).toBe("string");
  });

  it("choices 为空时抛出可捕获错误", () => {
    expect(() => DeepSeek.parseResponse({ choices: [] })).toThrow();
    expect(() => DeepSeek.parseResponse({})).toThrow();
  });

  it("内容中提取不到任何答案字母时抛错", () => {
    expect(() => DeepSeek.parseResponse(wrap("我不知道这道题"))).toThrow();
  });
});
