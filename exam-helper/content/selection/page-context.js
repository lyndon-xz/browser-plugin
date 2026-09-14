/** 选区文本是否已包含 A/B/C/D 选项行 */
export function textHasOptions(text) {
  return /[A-D][\.．、:：)\]）]/.test(String(text ?? ""));
}

const OPTION_LINE = /^[A-D][\.．、:：)\]）]\s*.+/;

function collectOptionLines(root) {
  const seen = new Set();
  const found = [];

  const blocks = root.querySelectorAll(
    "li.option, label.option, .option, li, label",
  );
  for (const block of blocks) {
    const line = block.textContent?.replace(/\s+/g, " ").trim();
    if (!line || line.length > 420) {
      continue;
    }
    if (!OPTION_LINE.test(line)) {
      continue;
    }
    const key = line.slice(0, 80);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    found.push(line);
  }

  return found.sort((a, b) => a.charCodeAt(0) - b.charCodeAt(0)).slice(0, 6);
}

/** 容器里是否有多道带选项的题（整页 wrapper），不能再往上抓选项 */
function isMultiQuestionRoot(el) {
  const blocks = el.querySelectorAll(
    "article, .question-card, .card, [data-question]",
  );
  let withOptions = 0;
  for (const block of blocks) {
    if (collectOptionLines(block).length >= 2) {
      withOptions += 1;
    }
  }
  return withOptions > 1;
}

/** 从选区所在的**同一道题**内抓取选项，不跨题、不扫整页。 */
export function scrapeOptionsNearSelection(selection) {
  if (!selection?.rangeCount) {
    return [];
  }

  let node = selection.getRangeAt(0).commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }

  for (
    let el = node;
    el && el !== document.documentElement;
    el = el.parentElement
  ) {
    if (isMultiQuestionRoot(el)) {
      break;
    }
    const found = collectOptionLines(el);
    if (found.length >= 2) {
      return found;
    }
  }

  return [];
}

/**
 * 合并选区文字 + 页面 DOM 选项，供题库匹配与 AI 使用。
 */
export function buildAssistText(selection, selectedText) {
  const stem = String(selectedText ?? "").trim();
  if (!stem) {
    return { text: "", hasOptions: false, fromDom: false };
  }
  if (textHasOptions(stem)) {
    return { text: stem, hasOptions: true, fromDom: false };
  }

  const domOptions = scrapeOptionsNearSelection(selection);
  if (domOptions.length >= 2) {
    return {
      text: `${stem}\n${domOptions.join("\n")}`,
      hasOptions: true,
      fromDom: true,
    };
  }

  return { text: stem, hasOptions: false, fromDom: false };
}
