// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { Bubble } from "../content/bubble.js";

/**
 * M1-S3 气泡渲染组件测试（对应验收 V-3：Shadow DOM 隔离）
 *
 * 断言范围：DOM 结构、文本内容、可见性状态、样式隔离。
 * 不依赖 jsdom 下的真实像素度量（getBoundingClientRect 恒为 0 属正常）。
 */

const RECT = { top: 100, left: 20, bottom: 120, width: 200, height: 20 };

function getHost() {
  // shadow host 应挂在 document.body 下
  return [...document.body.children].find((el) => el.shadowRoot);
}

describe("Bubble 气泡渲染组件", () => {
  beforeEach(() => {
    // 每个用例前清空 body，保证 Bubble 惰性重建
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    Bubble._reset && Bubble._reset();
  });

  it("show('hit') 后 body 上存在带 shadowRoot 的 host 元素", () => {
    Bubble.show(
      "hit",
      { answer: ["B", "C", "D"], type: "multi", explain: "解析内容示例" },
      RECT
    );
    const host = getHost();
    expect(host).toBeTruthy();
    expect(host.shadowRoot).toBeTruthy();
  });

  it("hit 状态渲染答案徽章、题型标签、解析文本、来源标签", () => {
    Bubble.show(
      "hit",
      {
        answer: ["B", "C", "D"],
        type: "multi",
        explain: "Timer 会终止所有任务，推荐 ScheduledExecutorService。",
      },
      RECT
    );
    const root = getHost().shadowRoot;
    const text = root.textContent;
    expect(text).toContain("B C D");
    expect(text).toContain("多选");
    expect(text).toContain("Timer 会终止所有任务");
    // 默认来源为题库命中
    expect(text).toContain("📚 题库命中");
  });

  it("single 题型渲染为 '单选'", () => {
    Bubble.show(
      "hit",
      { answer: ["A"], type: "single", explain: "TreeMap 的 key 不可为 null。" },
      RECT
    );
    const text = getHost().shadowRoot.textContent;
    expect(text).toContain("单选");
    expect(text).toContain("A");
  });

  it("source:'ai' 时来源标签显示 AI 推理", () => {
    Bubble.show(
      "hit",
      {
        answer: ["A"],
        type: "single",
        explain: "AI 推理结果。",
        source: "ai",
      },
      RECT
    );
    const text = getHost().shadowRoot.textContent;
    expect(text).toContain("🤖 AI 推理");
    expect(text).not.toContain("📚 题库命中");
  });

  it("show('loading') 渲染 spinner 与 'AI 推理中' 文案", () => {
    Bubble.show("loading", {}, RECT);
    const root = getHost().shadowRoot;
    expect(root.textContent).toContain("AI 推理中");
    expect(root.querySelector(".spinner")).toBeTruthy();
  });

  it("show('error', {message}) 渲染 '⚠ ' + message", () => {
    Bubble.show("error", { message: "API 请求失败，请检查网络连接" }, RECT);
    const text = getHost().shadowRoot.textContent;
    expect(text).toContain("⚠");
    expect(text).toContain("API 请求失败，请检查网络连接");
  });

  it("hide() 后 host 不可见（display:none 或尺寸为 0）", () => {
    Bubble.show("hit", { answer: ["A"], type: "single", explain: "x" }, RECT);
    const host = getHost();
    Bubble.hide();
    // host 仍存在但不可见
    const stillHost = getHost();
    expect(stillHost).toBe(host);
    expect(host.style.display).toBe("none");
  });

  it("样式隔离：样式注入在 shadowRoot 内，不污染 document.head", () => {
    Bubble.show("hit", { answer: ["A"], type: "single", explain: "x" }, RECT);
    const root = getHost().shadowRoot;
    // shadowRoot 内应存在 style
    expect(root.querySelector("style")).toBeTruthy();
    // 宿主页 head 不应被注入气泡样式
    expect(document.head.querySelector("style")).toBeNull();
  });

  it("气泡容器 pointer-events 为 none（不挡宿主页交互）", () => {
    Bubble.show("hit", { answer: ["A"], type: "single", explain: "x" }, RECT);
    const root = getHost().shadowRoot;
    const container = root.querySelector(".bubble-root");
    expect(container).toBeTruthy();
    expect(container.style.pointerEvents).toBe("none");
  });

  it("rect 缺省时不抛错（top/left 兜底为 0）", () => {
    expect(() =>
      Bubble.show("hit", { answer: ["A"], type: "single", explain: "x" })
    ).not.toThrow();
  });
});
