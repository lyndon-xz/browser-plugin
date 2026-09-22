/*
 * 答案气泡：position:fixed 挂在 body，滚动时跟随选区锚点重算位置。
 */
import { DESIGN_TOKENS_CSS } from "./tokens.js";
import { escapeHtml, formatExplain } from "../utils/html.js";

let host = null;
let shadowRoot = null;
let rootEl = null;
let lockedRect = null;
let hideTimer = null;
let dismissBound = false;
let viewportBound = false;
let viewportSyncFrame = 0;
let resolveAnchor = null;

const AUTO_HIDE_MS = 12_000;

const STYLE_TEXT = `
    ${DESIGN_TOKENS_CSS}
    :host {
      display: block;
      pointer-events: none;
    }
    .bubble-shell {
      position: relative;
      box-sizing: border-box;
      background: var(--surface);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow:
        0 14px 36px var(--shadow),
        0 1px 0 rgba(255, 255, 255, 0.9) inset;
      animation: bubbleFadeIn .18s ease-out;
      pointer-events: none;
    }
    .bubble-shell::before {
      content: "";
      position: absolute;
      top: -6px;
      left: 22px;
      width: 12px;
      height: 12px;
      background: #fff;
      border-left: 1px solid var(--border);
      border-top: 1px solid var(--border);
      transform: rotate(45deg);
      border-radius: 3px;
    }
    .bubble-shell.is-above::before {
      top: auto;
      bottom: -6px;
      border-left: none;
      border-top: none;
      border-right: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
    }
    .bubble {
      width: 340px;
      color: var(--text-primary);
      padding: 14px 16px;
      font-size: 13px;
      line-height: 1.65;
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
      background: linear-gradient(transparent 58%, var(--highlight) 58%);
      border-radius: 4px;
      flex-shrink: 0;
    }
    .answer-type { font-size: 11px; color: var(--text-secondary); }
    .answer-explain {
      color: var(--text-muted);
      font-size: 12.5px;
      line-height: 1.65;
    }
    .source-tag {
      display: block;
      margin-top: 8px;
      font-size: 11px;
      line-height: 1.4;
      color: var(--text-secondary);
    }
    .bubble-loading {
      color: var(--text-secondary);
      padding: 11px 16px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .spinner {
      width: 13px;
      height: 13px;
      border: 2px solid var(--surface-input);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    .bubble-error {
      color: var(--error);
      padding: 11px 16px;
      font-size: 13px;
      line-height: 1.6;
    }
    @keyframes bubbleFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;

const BUBBLE_WIDTH = 340;
const BUBBLE_OFFSET = 8;
const VIEWPORT_MARGIN = 10;
const FALLBACK_HEIGHT = 96;
const OFFSCREEN_MARGIN = 48;

function clearAutoHide() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function scheduleAutoHide(state) {
  clearAutoHide();
  if (state === "loading") {
    return;
  }
  hideTimer = setTimeout(() => {
    Bubble.hide();
  }, AUTO_HIDE_MS);
}

function isRectOnScreen(rect) {
  if (!rect) {
    return false;
  }
  return (
    rect.bottom > -OFFSCREEN_MARGIN &&
    rect.top < window.innerHeight + OFFSCREEN_MARGIN
  );
}

function bindDismissListeners() {
  if (dismissBound) {
    return;
  }
  dismissBound = true;
  document.addEventListener(
    "mousedown",
    () => {
      if (host && host.style.display !== "none") {
        Bubble.hide();
      }
    },
    true,
  );
}

function bindViewportListeners() {
  if (viewportBound) {
    return;
  }
  viewportBound = true;

  const scheduleSync = () => {
    if (viewportSyncFrame) {
      return;
    }
    viewportSyncFrame = requestAnimationFrame(() => {
      viewportSyncFrame = 0;
      Bubble.syncPosition();
    });
  };

  window.addEventListener("resize", scheduleSync, { passive: true });
  document.addEventListener("scroll", scheduleSync, {
    capture: true,
    passive: true,
  });
}

function ensureHost() {
  if (host?.isConnected) {
    return;
  }
  host = document.createElement("div");
  host.setAttribute("data-eh-bubble", "");
  Object.assign(host.style, {
    position: "fixed",
    zIndex: "2147483646",
    pointerEvents: "none",
    margin: "0",
    padding: "0",
    border: "0",
    width: `${BUBBLE_WIDTH}px`,
    display: "none",
    top: "0",
    left: "0",
  });
  host.style.setProperty("position", "fixed", "important");

  shadowRoot = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = STYLE_TEXT;
  shadowRoot.appendChild(style);

  rootEl = document.createElement("div");
  shadowRoot.appendChild(rootEl);

  (document.body || document.documentElement).appendChild(host);
  bindDismissListeners();
  bindViewportListeners();
}

function renderHit(data) {
  const answer = Array.isArray(data?.answer) ? data.answer : [];
  const answerText = answer.join(" ");
  const typeLabel = data?.type === "single" ? "单选" : "多选";
  const explain = formatExplain(data?.explain ?? "");
  const SOURCE_LABEL = {
    ai: "🤖 AI 推理",
    db: "📚 答案匹配",
  };
  const sourceLabel = SOURCE_LABEL[data?.source] ?? SOURCE_LABEL.db;
  const explainHtml = explain
    ? `<div class="answer-explain">${escapeHtml(explain)}</div>`
    : "";
  const sourceHtml = sourceLabel
    ? `<span class="source-tag">${sourceLabel}</span>`
    : "";

  return `
      <div class="bubble-shell bubble">
        <div class="answer-line">
          <span class="answer-badge">${escapeHtml(answerText)}</span>
          <span class="answer-type">${typeLabel}</span>
        </div>
        ${explainHtml}
        ${sourceHtml}
      </div>
    `;
}

function renderLoading() {
  return `
      <div class="bubble-shell bubble-loading">
        <div class="spinner"></div>
        <span>AI 推理中…</span>
      </div>
    `;
}

function renderError(data) {
  const message = data?.message ?? "发生未知错误";
  return `
      <div class="bubble-shell bubble-error">${escapeHtml(message)}</div>
    `;
}

function applyPosition(rect) {
  if (!host) {
    return;
  }

  lockedRect = rect ?? lockedRect;
  const r = lockedRect ?? {};
  let left =
    typeof r.left === "number"
      ? r.left
      : Math.max(VIEWPORT_MARGIN, window.innerWidth / 2 - BUBBLE_WIDTH / 2);
  let top =
    typeof r.bottom === "number"
      ? r.bottom + BUBBLE_OFFSET
      : VIEWPORT_MARGIN + 48;

  const bubbleHeight = host.offsetHeight || FALLBACK_HEIGHT;
  const maxLeft = window.innerWidth - BUBBLE_WIDTH - VIEWPORT_MARGIN;
  const maxTop = window.innerHeight - bubbleHeight - VIEWPORT_MARGIN;
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, maxLeft));

  let placeAbove = false;
  if (top + bubbleHeight > window.innerHeight - VIEWPORT_MARGIN) {
    const aboveTop =
      (typeof r.top === "number" ? r.top : top) - bubbleHeight - BUBBLE_OFFSET;
    if (aboveTop >= VIEWPORT_MARGIN) {
      top = aboveTop;
      placeAbove = true;
    }
  }
  top = Math.max(VIEWPORT_MARGIN, Math.min(top, maxTop));

  host.style.left = `${left}px`;
  host.style.top = `${top}px`;

  const shell = rootEl.querySelector(".bubble-shell");
  shell?.classList.toggle("is-above", placeAbove);
}

export const Bubble = {
  setAnchorResolver(fn) {
    resolveAnchor = typeof fn === "function" ? fn : null;
  },

  syncPosition() {
    if (!host || host.style.display === "none") {
      return;
    }

    const rect = resolveAnchor?.() ?? lockedRect;
    if (!isRectOnScreen(rect)) {
      Bubble.hide();
      return;
    }
    applyPosition(rect);
  },

  show(state, data, rect) {
    ensureHost();

    if (state === "loading") {
      rootEl.innerHTML = renderLoading();
    } else if (state === "error") {
      rootEl.innerHTML = renderError(data);
    } else {
      rootEl.innerHTML = renderHit(data);
    }

    lockedRect = rect ?? lockedRect;
    host.style.display = "block";
    applyPosition(rect);
    requestAnimationFrame(() => applyPosition(rect));
    scheduleAutoHide(state);
  },

  hide() {
    clearAutoHide();
    if (!host) {
      return;
    }
    rootEl.innerHTML = "";
    host.style.display = "none";
    lockedRect = null;
  },
};
