/**
 * 选区编排入口 content.js（M1-S5，对应验收 V-1、V-4）
 *
 * 职责：监听宿主页文本选区，debounce 300ms 后取选区文本调用 Matcher；
 *   命中则用 Bubble 在选区下方显示答案气泡，取消选区/未命中则隐藏气泡。
 *   受启用开关控制（Alt+Q），并监听后台的 toggle 消息实时更新开关。
 *
 * 依赖（manifest 按序注入的全局）：EXAM_QUESTIONS、Matcher、StorageHelper、Bubble。
 * 未命中的 AI 兜底分支在 M3 接入，M1 骨架仅处理命中/隐藏。
 */
(function () {
  "use strict";

  const DEBOUNCE_MS = 300;
  let enabled = true;
  let debounceTimer = null;

  // 初始启用状态从存储读取（默认 true）
  try {
    StorageHelper.getEnabled().then(function (v) {
      enabled = v;
      if (!enabled) Bubble.hide();
    });
  } catch (e) {
    /* storage 不可用时保持默认启用 */
  }

  // 取当前选区文本与位置（视口坐标，配合 Bubble 的 position:fixed）
  function getSelectionInfo() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const text = sel.toString().trim();
    if (!text) return null;
    let rect = null;
    try {
      const r = sel.getRangeAt(0).getBoundingClientRect();
      rect = {
        top: r.top,
        left: r.left,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    } catch (e) {
      /* 某些节点取不到 rect，用默认定位 */
    }
    return { text: text, rect: rect };
  }

  function handleSelection() {
    if (!enabled) {
      Bubble.hide();
      return;
    }
    const info = getSelectionInfo();
    if (!info) {
      // 取消选区 → 气泡立即消失（design.md DD-4）
      Bubble.hide();
      return;
    }
    const hit = Matcher.match(EXAM_QUESTIONS, info.text);
    if (hit) {
      Bubble.show(
        "hit",
        {
          answer: hit.answer,
          type: hit.type,
          explain: hit.explain,
          source: "db",
        },
        info.rect,
      );
    } else {
      // M1：未命中不弹 AI（留待 M3）；隐藏可能存在的旧气泡
      Bubble.hide();
    }
  }

  function onSelectionChange() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(handleSelection, DEBOUNCE_MS);
  }

  document.addEventListener("selectionchange", onSelectionChange);
  document.addEventListener("mouseup", onSelectionChange);

  // 监听后台 Alt+Q 切换消息，实时更新启用标志
  try {
    chrome.runtime.onMessage.addListener(function (message) {
      if (message && message.action === "toggle") {
        enabled = !!message.enabled;
        if (!enabled) Bubble.hide();
      }
    });
  } catch (e) {
    /* 扩展上下文失效（孤儿 content script），静默降级 */
  }
})();
