/*
 * 划词助手：选中文字 + ⌃⇧A → 题库 / AI。
 * 重模块懒加载，init 同步完成以便快捷键尽早生效。
 */
import { MESSAGE_ACTION, ask } from "../../shared/utils/messages.js";
import { STORAGE_KEYS, StorageHelper } from "../../shared/utils/storage.js";

import { buildAssistText } from "../selection/page-context.js";
import { Bubble } from "../../shared/ui/bubble.js";
import {
  readRangeRect,
  readSelectionRect,
} from "../selection/selection-rect.js";
const CACHE_TTL_MS = 120_000;

let enabled = false;
let isStorageReady = false;
let requestSeq = 0;
let lastRect = null;
let cachedSelection = null;
let cachedAnchorRange = null;
let bankLoad = null;

export function isAskShortcut(event) {
  if (event.metaKey || event.altKey) {
    return false;
  }
  if (!event.ctrlKey || !event.shiftKey) {
    return false;
  }
  if (event.code === "KeyA" || event.keyCode === 65) {
    return true;
  }
  const key = String(event.key ?? "").toLowerCase();
  return key === "a";
}

// 练习页只匹配当前卷子；其它页面匹配预置题库
async function loadBank() {
  const matcherMod = await import("../../shared/utils/matcher.js");
  const paperQs = window.__ehPaperQuestions;

  if (Array.isArray(paperQs) && paperQs.length) {
    return {
      questions: paperQs,
      match: matcherMod.match,
      score: matcherMod.score,
      normalize: matcherMod.normalize,
      scope: "paper",
    };
  }

  if (!bankLoad) {
    bankLoad = import("../../data/exam-bank.js").then((bankMod) => ({
      questions: bankMod.EXAM_BANK.questions,
      match: matcherMod.match,
      score: matcherMod.score,
      normalize: matcherMod.normalize,
      scope: "static",
    }));
  }
  return bankLoad;
}

function getSelectionInfo() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
    return null;
  }
  const raw = sel.toString().trim();
  if (!raw) {
    return null;
  }

  const ctx = buildAssistText(sel, raw);
  return {
    text: ctx.text,
    rawText: raw,
    hasOptions: ctx.hasOptions,
    optionsFromDom: ctx.fromDom,
    rect: readSelectionRect(sel) ?? lastRect,
  };
}

function rememberSelection(info) {
  if (!info?.rawText) {
    return;
  }
  cachedSelection = { info, at: Date.now() };
  lastRect = info.rect;

  const sel = window.getSelection();
  if (sel?.rangeCount) {
    try {
      cachedAnchorRange = sel.getRangeAt(0).cloneRange();
    } catch {
      cachedAnchorRange = null;
    }
  }
}

function resolveBubbleAnchor() {
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
    const rect = readSelectionRect(sel);
    if (rect) {
      lastRect = rect;
      return rect;
    }
  }

  if (cachedAnchorRange) {
    try {
      const rect = readRangeRect(cachedAnchorRange);
      if (rect) {
        lastRect = rect;
        return rect;
      }
    } catch {
      cachedAnchorRange = null;
    }
  }

  return null;
}

function clearSelectionCache() {
  cachedSelection = null;
  cachedAnchorRange = null;
}

function resolveSelectionInfo() {
  const live = getSelectionInfo();
  if (live) {
    rememberSelection(live);
    return live;
  }
  if (cachedSelection && Date.now() - cachedSelection.at <= CACHE_TTL_MS) {
    return cachedSelection.info;
  }
  return null;
}

function syncSelectionCache() {
  const live = getSelectionInfo();
  if (live) {
    rememberSelection(live);
  }
}

async function askAI(text, seq) {
  try {
    const result = await ask(MESSAGE_ACTION.askAI, { text });
    if (seq !== requestSeq || !enabled) {
      return;
    }
    Bubble.show(
      "hit",
      {
        answer: result.answer,
        type: result.answer && result.answer.length > 1 ? "multi" : "single",
        explain: result.explain || "",
        source: "ai",
      },
      lastRect,
    );
  } catch (error) {
    if (seq !== requestSeq || !enabled) {
      return;
    }
    Bubble.show(
      "error",
      { message: error?.message ?? "AI 请求失败" },
      lastRect,
    );
  }
}

async function ensureReady() {
  if (isStorageReady) {
    return enabled;
  }
  try {
    enabled = await StorageHelper.getEnabled();
  } catch {
    enabled = false;
  } finally {
    isStorageReady = true;
  }
  return enabled;
}

export async function runQuery() {
  const seq = ++requestSeq;
  const isOn = await ensureReady();

  if (!isOn) {
    Bubble.show("error", { message: "请先在 popup 里点击「启用」" }, lastRect);
    return;
  }

  const info = resolveSelectionInfo();
  if (!info) {
    Bubble.show("error", { message: "请先选中题目文字" }, lastRect);
    return;
  }

  lastRect = info.rect;

  let bank;
  try {
    bank = await loadBank();
  } catch (error) {
    Bubble.show(
      "error",
      { message: "题库加载失败，请重载扩展后重试" },
      info.rect,
    );
    console.error("[eh] bank load:", error);
    return;
  }

  let hit = bank.match(bank.questions, info.text);
  if (hit && info.optionsFromDom) {
    const stemScore = bank.score(
      bank.normalize(info.rawText),
      bank.normalize(hit.title),
    );
    if (stemScore < 0.4) {
      hit = null;
    }
  }
  if (hit) {
    Bubble.show(
      "hit",
      {
        answer: hit.answer,
        type: hit.type,
        explain:
          hit.explain ||
          (info.optionsFromDom && bank.scope !== "paper"
            ? "已从页面自动补全选项"
            : ""),
        source: "db",
      },
      info.rect,
    );
    return;
  }

  if (!info.hasOptions) {
    Bubble.show(
      "error",
      {
        message:
          "未识别为选择题（选中区域附近没有 A/B/C/D 选项），题库未命中且不会调用 AI。请选中题目卡片内的题干。",
      },
      info.rect,
    );
    return;
  }

  Bubble.show("loading", {}, info.rect);
  void askAI(info.text, seq);
}

function onAskShortcut(event) {
  if (event.repeat || !isAskShortcut(event)) {
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  void runQuery();
}

function bindGlobalTrigger() {
  window.__ehTriggerQuery = () => {
    void runQuery();
  };
}

let assistMounted = false;

export function init() {
  if (assistMounted) {
    return () => {};
  }
  assistMounted = true;
  bindGlobalTrigger();
  Bubble.setAnchorResolver(resolveBubbleAnchor);

  document.addEventListener("selectionchange", syncSelectionCache, true);
  document.addEventListener("mouseup", syncSelectionCache, true);
  document.addEventListener("keydown", onAskShortcut, true);

  const onMessage = (message, _sender, respond) => {
    if (message?.action === MESSAGE_ACTION.toggle) {
      enabled = !!message.enabled;
      isStorageReady = true;
      if (!enabled) {
        Bubble.hide();
        clearSelectionCache();
      }
      respond({ ok: true });
      return true;
    }
    if (message?.action === MESSAGE_ACTION.runQuery) {
      void runQuery();
      respond({ ok: true });
      return true;
    }
    return false;
  };

  const onStorageChange = (changes, area) => {
    if (area !== "local") {
      return;
    }
    if (changes[STORAGE_KEYS.enabled]) {
      enabled = !!changes[STORAGE_KEYS.enabled].newValue;
      isStorageReady = true;
      if (!enabled) {
        Bubble.hide();
        clearSelectionCache();
      }
    }
  };

  try {
    chrome.runtime.onMessage.addListener(onMessage);
    chrome.storage.onChanged.addListener(onStorageChange);
  } catch (e) {
    console.warn("[eh] message listener:", e);
  }

  void ensureReady();
  document.documentElement.setAttribute("data-eh-ready", "1");

  const onPaperUpdated = () => {
    bankLoad = null;
  };
  window.addEventListener("eh-paper-updated", onPaperUpdated);

  return () => {
    assistMounted = false;
    document.removeEventListener("selectionchange", syncSelectionCache, true);
    document.removeEventListener("mouseup", syncSelectionCache, true);
    document.removeEventListener("keydown", onAskShortcut, true);
    window.removeEventListener("eh-paper-updated", onPaperUpdated);
    try {
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.storage.onChanged.removeListener(onStorageChange);
    } catch (e) {
      /* 忽略 */
    }
    delete window.__ehTriggerQuery;
    document.documentElement.removeAttribute("data-eh-ready");
    Bubble.setAnchorResolver(null);
    Bubble.hide();
    clearSelectionCache();
  };
}
