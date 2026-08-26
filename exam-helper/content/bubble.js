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

  // 注入 shadow-root 的样式：深色毛玻璃卡片，视觉对齐 designs/bubble-prototype.html
  const STYLE_TEXT = `
    :host { all: initial; }
    .bubble-root {
      position: fixed;
      z-index: 2147483647;
      pointer-events: none;
      font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    .bubble {
      position: relative;
      width: 360px;
      box-sizing: border-box;
      background: #1a1a2e;
      color: #e0e0e0;
      border-radius: 10px;
      padding: 14px 16px;
      font-size: 13px;
      line-height: 1.6;
      box-shadow: 0 8px 32px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06);
      animation: bubbleFadeIn .15s ease-out;
    }
    .bubble::before {
      content: "";
      position: absolute;
      top: -6px;
      left: 24px;
      width: 12px;
      height: 12px;
      background: #1a1a2e;
      transform: rotate(45deg);
      border-radius: 2px;
    }
    .answer-line {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 8px;
    }
    .answer-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: #16a34a;
      color: #fff;
      font-weight: 700;
      font-size: 15px;
      letter-spacing: 2px;
      padding: 2px 10px;
      border-radius: 5px;
      flex-shrink: 0;
    }
    .answer-type { font-size: 11px; color: #9ca3af; }
    .answer-explain {
      color: #c4c4c4;
      font-size: 12px;
      line-height: 1.6;
      border-top: 1px solid rgba(255,255,255,.08);
      padding-top: 8px;
      margin-top: 4px;
    }
    .source-tag {
      display: inline-block;
      margin-top: 6px;
      font-size: 10px;
      color: #6b7280;
      background: rgba(255,255,255,.06);
      padding: 1px 6px;
      border-radius: 3px;
    }
    .bubble-loading {
      position: relative;
      background: #1a1a2e;
      color: #9ca3af;
      border-radius: 10px;
      padding: 10px 16px;
      font-size: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06);
      display: flex;
      align-items: center;
      gap: 8px;
      animation: bubbleFadeIn .15s ease-out;
    }
    .bubble-loading::before {
      content: "";
      position: absolute;
      top: -6px;
      left: 24px;
      width: 12px;
      height: 12px;
      background: #1a1a2e;
      transform: rotate(45deg);
      border-radius: 2px;
    }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,.15);
      border-top-color: #60a5fa;
      border-radius: 50%;
      animation: spin .6s linear infinite;
    }
    .bubble-error {
      position: relative;
      background: #1a1a2e;
      color: #f87171;
      border-radius: 10px;
      padding: 10px 16px;
      font-size: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06);
      animation: bubbleFadeIn .15s ease-out;
    }
    .bubble-error::before {
      content: "";
      position: absolute;
      top: -6px;
      left: 24px;
      width: 12px;
      height: 12px;
      background: #1a1a2e;
      transform: rotate(45deg);
      border-radius: 2px;
    }
    @keyframes bubbleFadeIn {
      from { opacity: 0; transform: translateY(4px); }
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

    return `
      <div class="bubble">
        <div class="answer-line">
          <span class="answer-badge">${escapeHtml(answerText)}</span>
          <span class="answer-type">${typeLabel}</span>
        </div>
        <div class="answer-explain">${escapeHtml(explain)}</div>
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
      <div class="bubble-error">⚠ ${escapeHtml(message)}</div>
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
