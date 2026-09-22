// service worker：快捷键、右键菜单、DeepSeek 代理、图标同步
import {
  AI_GENERATE_TIMEOUT_MS,
  AI_REQUEST_TIMEOUT_MS,
} from "./shared/utils/constants.js";
import {
  buildGenerateRequestBody,
  parseGeneratedQuestions,
} from "./shared/utils/ai-questions.js";
import { DeepSeek } from "./shared/utils/deepseek.js";
import { MESSAGE_ACTION } from "./shared/utils/messages.js";
import { STORAGE_KEYS, StorageHelper } from "./shared/utils/storage.js";
const MISSING_KEY_MESSAGE = "还没填写 DeepSeek 密钥，点工具栏图标打开弹窗即可";
const MENU_ID = "eh-ask-selection";

const ICON_SIZES = [16, 32, 48, 128];
let activeAskAbort = null;

function buildIconSet(state) {
  return Object.fromEntries(
    ICON_SIZES.map((size) => [size, `icons/${state}/icon-${size}.png`]),
  );
}

const ICONS = {
  active: buildIconSet("active"),
  inactive: buildIconSet("inactive"),
};

async function applyIcon(enabled) {
  try {
    await chrome.action.setIcon({
      path: enabled ? ICONS.active : ICONS.inactive,
    });
  } catch (e) {
    console.warn("[exam-helper] 图标设置失败：", e);
  }
}

async function syncEnabledVisuals(enabled) {
  await applyIcon(enabled);
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id != null) {
      await chrome.tabs.sendMessage(tab.id, {
        action: MESSAGE_ACTION.toggle,
        enabled,
      });
    }
  } catch (e) {
    /* 忽略 */
  }
}

async function syncEnabledState(enabled) {
  await StorageHelper.setEnabled(enabled);
  await syncEnabledVisuals(enabled);
}

// 避免并发注册导致 duplicate id
let contextMenuReady = null;

function ensureContextMenu() {
  if (contextMenuReady) {
    return contextMenuReady;
  }
  contextMenuReady = new Promise((resolve) => {
    chrome.contextMenus.remove(MENU_ID, () => {
      void chrome.runtime.lastError;
      chrome.contextMenus.create(
        {
          id: MENU_ID,
          title: "exam-helper：查答案",
          contexts: ["selection"],
        },
        () => {
          void chrome.runtime.lastError;
          resolve();
        },
      );
    });
  });
  return contextMenuReady;
}

void (async () => {
  const enabled = await StorageHelper.getEnabled();
  applyIcon(enabled);
  await ensureContextMenu();
})();

chrome.runtime.onInstalled.addListener(() => {
  contextMenuReady = null;
  void ensureContextMenu();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[STORAGE_KEYS.enabled]) {
    return;
  }
  void syncEnabledVisuals(!!changes[STORAGE_KEYS.enabled].newValue);
});

function isExtensionPage(url) {
  return typeof url === "string" && url.startsWith(chrome.runtime.getURL(""));
}

async function injectTrigger(tabId, world) {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    world,
    func: () => {
      window.__ehTriggerQuery?.();
    },
  });
}

// 普通页走 content script 消息；扩展自有页在 MAIN world 注入触发
async function triggerQueryOnTab(tab) {
  const tabId = tab?.id;
  if (tabId == null) {
    return;
  }

  if (isExtensionPage(tab.url)) {
    try {
      await injectTrigger(tabId, "MAIN");
    } catch (e) {
      /* 忽略 */
    }
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, { action: MESSAGE_ACTION.runQuery });
    return;
  } catch (e) {
    /* content script 尚未就绪 */
  }

  try {
    await injectTrigger(tabId, "ISOLATED");
  } catch (e) {
    /* 忽略 */
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-enable") {
    const current = await StorageHelper.getEnabled();
    await syncEnabledState(!current);
    return;
  }

  if (command === "ask-selection") {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab) {
      await triggerQueryOnTab(tab);
    }
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || tab?.id == null) {
    return;
  }
  await triggerQueryOnTab(tab);
});

async function callDeepSeek(body, timeoutMs, externalSignal) {
  const apiKey = await StorageHelper.getApiKey();
  if (!apiKey) {
    throw new Error(MISSING_KEY_MESSAGE);
  }

  const controller = new AbortController();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(DeepSeek.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`DeepSeek 请求失败（HTTP ${resp.status}）`);
    }
    return resp.json();
  } finally {
    clearTimeout(timer);
  }
}

async function askDeepSeek(text, externalSignal) {
  const json = await callDeepSeek(
    DeepSeek.buildRequestBody(text),
    AI_REQUEST_TIMEOUT_MS,
    externalSignal,
  );
  return DeepSeek.parseResponse(json);
}

async function generateQuestionsFromExcerpt(message) {
  const excerpt = String(message.excerpt ?? "");
  const count = Math.max(1, Math.min(3, Number(message.count) || 2));
  const idPrefix = String(message.idPrefix ?? "ai");
  const json = await callDeepSeek(
    buildGenerateRequestBody(excerpt, count, { reuse: message.reuse }),
    AI_GENERATE_TIMEOUT_MS,
    null,
  );
  return parseGeneratedQuestions(json, idPrefix);
}

function cancelActiveAsk() {
  if (activeAskAbort) {
    activeAskAbort.abort();
    activeAskAbort = null;
  }
}

const HANDLERS = {
  [MESSAGE_ACTION.askAI]: (message) => {
    cancelActiveAsk();
    activeAskAbort = new AbortController();
    const signal = activeAskAbort.signal;
    return askDeepSeek(message.text, signal).finally(() => {
      if (activeAskAbort?.signal === signal) {
        activeAskAbort = null;
      }
    });
  },
  [MESSAGE_ACTION.generateQuestions]: (message) =>
    generateQuestionsFromExcerpt(message),
};

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  const handler = HANDLERS[message?.action];
  if (!handler) {
    respond({ isOk: false, error: `未知的 action：${message?.action}` });
    return false;
  }

  void (async () => {
    try {
      respond({ isOk: true, result: await handler(message) });
    } catch (error) {
      const aborted = error?.name === "AbortError";
      respond({
        isOk: false,
        error: aborted
          ? "AI 请求超时，请重试"
          : (error?.message ?? "AI 请求失败，请检查网络连接"),
      });
    }
  })();

  return true;
});
