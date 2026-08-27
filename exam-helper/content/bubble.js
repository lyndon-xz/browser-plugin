/**
 * 气泡渲染组件 Bubble（M1-S3，对应验收 V-3：Shadow DOM 隔离）
 *
 * 职责：把答案 / 加载 / 错误三种状态渲染到一个挂在 document.body 的
 * shadow host 上。样式全部内联注入 shadow-root，绝不污染宿主页 document。
 *
 * UMD 包装（TD-2，风格对齐 data/questions.js）：
 *   浏览器普通脚本加载 → global.Bubble；Node/Vitest → module.exports = { Bubble }。
 *
 * API：
 *   Bubble.show(state, data, rect)  state ∈ {"hit","loading","error"}
 *   Bubble.hide()
 */
(function (global) {
  "use strict";

  // shadow host 元素与其内部根容器缓存（惰性创建）
  let host = null;
  let shadowRoot = null;
  let rootEl = null;

  // 注入 shadow-root 的样式：半透明白 + 毛玻璃，对齐 designs/bubble-prototype.html
  const STYLE_TEXT = `
    :host { all: initial; }
    .bubble-root {
      position: fixed;
      z-index: 2147483647;
      pointer-events: none;
      font-family: -apple-system, "PingFang SC", "Segoe UI", sans-serif;
    }
    .bubble {
      position: relative;
      width: 340px;
      box-sizing: border-box;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      color: #2f3640;
      border: 1px solid rgba(47, 54, 64, 0.1);
      border-radius: 16px;
      padding: 14px 16px;
      font-size: 13px;
      line-height: 1.65;
      box-shadow:
        0 14px 36px rgba(47, 54, 64, 0.14),
        0 1px 0 rgba(255, 255, 255, 0.9) inset;
      animation: bubbleFadeIn .18s ease-out;
    }
    .bubble::before {
      content: "";
      position: absolute;
      top: -6px;
      left: 22px;
      width: 12px;
      height: 12px;
      background: #fff;
      border-left: 1px solid rgba(47, 54, 64, 0.1);
      border-top: 1px solid rgba(47, 54, 64, 0.1);
      transform: rotate(45deg);
      border-radius: 3px;
    }
    .answer-line {
      display: flex;
      align-items: baseline;
      gap: 10px;
      margin-bottom: 8px;
    }
    .answer-badge {
      display: inline-block;
      font-weight: 700;
      font-size: 16px;
      letter-spacing: 3px;
      padding: 1px 8px 2px;
      background: linear-gradient(transparent 58%, #ffe58a 58%);
      border-radius: 4px;
      flex-shrink: 0;
    }
    .answer-type { font-size: 11px; color: #6b7380; }
    .answer-explain {
      color: #5a6270;
      font-size: 12.5px;
      line-height: 1.65;
    }
    .source-tag {
      display: inline-block;
      margin-top: 8px;
      font-size: 11px;
      color: #6b7380;
    }
    .bubble-loading {
      position: relative;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      color: #6b7380;
      border: 1px solid rgba(47, 54, 64, 0.1);
      border-radius: 16px;
      padding: 11px 16px;
      font-size: 13px;
      box-shadow:
        0 14px 36px rgba(47, 54, 64, 0.14),
        0 1px 0 rgba(255, 255, 255, 0.9) inset;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: bubbleFadeIn .18s ease-out;
    }
    .bubble-loading::before {
      content: "";
      position: absolute;
      top: -6px;
      left: 22px;
      width: 12px;
      height: 12px;
      background: #fff;
      border-left: 1px solid rgba(47, 54, 64, 0.1);
      border-top: 1px solid rgba(47, 54, 64, 0.1);
      transform: rotate(45deg);
      border-radius: 3px;
    }
    .spinner {
      width: 13px;
      height: 13px;
      border: 2px solid #eef1f6;
      border-top-color: #5e8f7b;
      border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    .bubble-error {
      position: relative;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      color: #c45c5c;
      border: 1px solid rgba(47, 54, 64, 0.1);
      border-radius: 16px;
      padding: 11px 16px;
      font-size: 13px;
      line-height: 1.6;
      box-shadow:
        0 14px 36px rgba(47, 54, 64, 0.14),
        0 1px 0 rgba(255, 255, 255, 0.9) inset;
      animation: bubbleFadeIn .18s ease-out;
    }
    .bubble-error::before {
      content: "";
      position: absolute;
      top: -6px;
      left: 22px;
      width: 12px;
      height: 12px;
      background: #fff;
      border-left: 1px solid rgba(47, 54, 64, 0.1);
      border-top: 1px solid rgba(47, 54, 64, 0.1);
      transform: rotate(45deg);
      border-radius: 3px;
    }
    @keyframes bubbleFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;

  // 惰性创建 shadow host + 根容器 + 样式，只做一次
  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement("div");
    host.setAttribute("data-exam-helper", "bubble");
    shadowRoot = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = STYLE_TEXT;
    shadowRoot.appendChild(style);

    rootEl = document.createElement("div");
    rootEl.className = "bubble-root";
    rootEl.style.pointerEvents = "none";
    shadowRoot.appendChild(rootEl);

    document.body.appendChild(host);
  }

  // 简单文本转义，避免题库/AI 文本中的 HTML 被解释
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderHit(data) {
    const answer = Array.isArray(data && data.answer) ? data.answer : [];
    const answerText = answer.join(" ");
    const typeLabel = data && data.type === "single" ? "单选" : "多选";
    const explain = data && data.explain ? data.explain : "";
    const sourceLabel =
      data && data.source === "ai" ? "🤖 AI 推理" : "📚 题库命中";

    const explainHtml = explain
      ? `<div class="answer-explain">${escapeHtml(explain)}</div>`
      : "";

    return `
      <div class="bubble">
        <div class="answer-line">
          <span class="answer-badge">${escapeHtml(answerText)}</span>
          <span class="answer-type">${typeLabel}</span>
        </div>
        ${explainHtml}
        <span class="source-tag">${sourceLabel}</span>
      </div>
    `;
  }

  function renderLoading() {
    return `
      <div class="bubble-loading">
        <div class="spinner"></div>
        <span>AI 推理中…</span>
      </div>
    `;
  }

  function renderError(data) {
    const message = data && data.message ? data.message : "发生未知错误";
    return `
      <div class="bubble-error">${escapeHtml(message)}</div>
    `;
  }

  // 把气泡定位到选区下方：left 对齐 rect.left，top 放在 rect.bottom 附近
  function applyPosition(rect) {
    const r = rect || {};
    const left = typeof r.left === "number" ? r.left : 0;
    const bottom = typeof r.bottom === "number" ? r.bottom : 0;
    rootEl.style.left = left + "px";
    rootEl.style.top = bottom + 6 + "px";
  }

  const Bubble = {
    /**
     * 渲染并显示气泡。
     * @param {"hit"|"loading"|"error"} state
     * @param {object} data 依 state 而定的数据（见文件头）
     * @param {{top?:number,left?:number,bottom?:number,width?:number,height?:number}} [rect]
     */
    show(state, data, rect) {
      ensureHost();

      let html;
      if (state === "loading") {
        html = renderLoading();
      } else if (state === "error") {
        html = renderError(data);
      } else {
        // 默认按 hit 处理
        html = renderHit(data);
      }
      rootEl.innerHTML = html;

      applyPosition(rect);
      host.style.display = "block";
    },

    /** 隐藏气泡：清空内容并让 host 不可见（尺寸为 0）。 */
    hide() {
      if (!host) return;
      if (rootEl) rootEl.innerHTML = "";
      host.style.display = "none";
    },

    /** 测试辅助：重置内部缓存，使下次 show 重新惰性创建 host。 */
    _reset() {
      if (host && host.parentNode) host.parentNode.removeChild(host);
      host = null;
      shadowRoot = null;
      rootEl = null;
    },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { Bubble };
  } else {
    global.Bubble = Bubble;
  }
})(typeof self !== "undefined" ? self : this);
