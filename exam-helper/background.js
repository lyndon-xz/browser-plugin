/**
 * 后台 service worker background.js
 *
 * 职责：
 *   1) Alt+Q 全局快捷键（commands: toggle-enable）翻转启用状态、切图标、通知 content（M1-S6，V-4）
 *   2) 代理 content 的 DeepSeek 请求（M3-S2 / I1-S4，V-6/V-7/V-8）：
 *      从 chrome.storage.local 读 key，规避宿主页 CSP（TD-4、TD-7）
 */
importScripts("utils/storage.js");
importScripts("utils/deepseek.js");

const REQUEST_TIMEOUT_MS = 5000; // 需求 §6
const MISSING_KEY_MESSAGE =
  "还没填写 DeepSeek 密钥，点工具栏图标打开弹窗即可";

const ICON_SIZES = [16, 32, 48, 128];

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
    // 图标设置失败不影响核心功能
  }
}

// 启动时按存储状态同步一次图标
(async function initIcon() {
  const enabled = await StorageHelper.getEnabled();
  applyIcon(enabled);
})();

// Alt+Q → 翻转启用状态 → 更新图标 → 通知当前标签
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-enable") return;

  const current = await StorageHelper.getEnabled();
  const next = !current;
  await StorageHelper.setEnabled(next);
  await applyIcon(next);

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab && tab.id != null) {
      chrome.tabs.sendMessage(tab.id, { action: "toggle", enabled: next });
    }
  } catch (e) {
    // 无可通知的标签（如 chrome:// 页面）时忽略
  }
});

// 调用 DeepSeek：题库未命中时的 AI 兜底。空 key 不发请求（V-8）。
async function askDeepSeek(text) {
  const apiKey = await StorageHelper.getApiKey();
  if (!apiKey) {
    return { missingKey: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch(DeepSeek.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(DeepSeek.buildRequestBody(text)),
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`DeepSeek 请求失败（HTTP ${resp.status}）`);
    }
    const json = await resp.json();
    return DeepSeek.parseResponse(json); // { answer, explain }
  } finally {
    clearTimeout(timer);
  }
}

// content 未命中时发来 {action:"askAI", text}，回传 {answer,explain} 或 {error}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.action !== "askAI") return;
  askDeepSeek(message.text)
    .then((result) => {
      if (result && result.missingKey) {
        sendResponse({ ok: false, error: MISSING_KEY_MESSAGE });
        return;
      }
      sendResponse({ ok: true, ...result });
    })
    .catch((err) => {
      const aborted = err && err.name === "AbortError";
      sendResponse({
        ok: false,
        error: aborted ? "AI 请求超时，请重试" : "AI 请求失败，请检查网络连接",
      });
    });
  return true; // 异步 sendResponse
});
