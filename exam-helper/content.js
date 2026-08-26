/**
 * 选区编排入口 content.js（M1-S5 + M3-S3，对应验收 V-1、V-4、V-6、V-7）
 *
 * 职责：监听宿主页文本选区，debounce 300ms 后取选区文本调用 Matcher；
 *   命中 → Bubble 显示题库答案；未命中 → 显示 loading 并请求后台 DeepSeek，
 *   返回后显示 AI 答案态 / 错误态；取消选区/禁用 → 隐藏气泡。
 *   受启用开关控制（Alt+Q），并监听后台 toggle 消息实时更新开关。
 *
 * 依赖（manifest 按序注入的全局）：EXAM_QUESTIONS、Matcher、StorageHelper、Bubble。
 */
(function () {
  "use strict";

  const DEBOUNCE_MS = 300;
  let enabled = true;
  let debounceTimer = null;
  // 请求序号：AI 为异步，选区变化后旧响应作废，避免过期结果覆盖当前气泡
  let requestSeq = 0;

  try {
    StorageHelper.getEnabled().then(function (v) {
      enabled = v;
      if (!enabled) Bubble.hide();
    });
  } catch (e) {
    /* storage 不可用时保持默认启用 */
  }

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
    // 每次处理都推进序号，令上一次未返回的 AI 请求作废
    const seq = ++requestSeq;

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
      return;
    }

    // 未命中 → 先显示 loading，请求后台 DeepSeek 兜底
    Bubble.show("loading", {}, info.rect);
    askAI(info.text, info.rect, seq);
  }

  function askAI(text, rect, seq) {
    let responded = false;
    try {
      chrome.runtime.sendMessage(
        { action: "askAI", text: text },
        function (res) {
          responded = true;
          // 选区已变化 / 已被新的请求取代 → 丢弃过期响应
          if (seq !== requestSeq || !enabled) return;
          if (chrome.runtime.lastError || !res) {
            Bubble.show(
              "error",
              { message: "AI 请求失败，请检查网络连接" },
              rect,
            );
            return;
          }
          if (res.ok) {
            Bubble.show(
              "hit",
              {
                answer: res.answer,
                type: res.answer && res.answer.length > 1 ? "multi" : "single",
                explain: res.explain || "",
                source: "ai",
              },
              rect,
            );
          } else {
            Bubble.show("error", { message: res.error || "AI 请求失败" }, rect);
          }
        },
      );
    } catch (e) {
      // 扩展上下文失效（孤儿 content script）
      if (seq === requestSeq)
        Bubble.show("error", { message: "扩展需要重新加载" }, rect);
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
