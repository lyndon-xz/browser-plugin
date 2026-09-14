/** 弹窗：展示启用状态，读写本机 DeepSeek API 密钥。 */
import {
  StorageHelper,
  STORAGE_KEYS,
  watchLocalStorage,
} from "../shared/utils/storage.js";

const powerEl = document.getElementById("status");
const statusText = document.getElementById("status-text");
const toggleInput = document.getElementById("toggle");
const input = document.getElementById("key");
const save = document.getElementById("save");
const well = document.getElementById("well");
const meta = document.getElementById("meta");

let enabled = false;

function maskTail(key) {
  const tail = String(key).slice(-4);
  return "已保存在本机 · sk-••••" + tail;
}

function renderEnabled(next) {
  enabled = !!next;
  powerEl.classList.toggle("off", !enabled);
  powerEl.classList.remove("is-error");
  statusText.textContent = enabled ? "已启用" : "未启用";
  toggleInput.checked = enabled;
}

function renderKey(key) {
  if (key) {
    well.classList.add("saved");
    meta.classList.add("ok");
    meta.textContent = maskTail(key);
  } else {
    well.classList.remove("saved");
    meta.classList.remove("ok");
    meta.textContent = "未配置 — 匹配不到时将无法 AI 推理";
  }
}

async function setEnabled(next) {
  toggleInput.disabled = true;
  try {
    await StorageHelper.setEnabled(next);
    renderEnabled(next);
  } catch (e) {
    console.error("[exam-helper] 切换启用状态失败：", e);
    powerEl.classList.add("is-error");
    statusText.textContent = "切换失败";
    toggleInput.checked = enabled;
  } finally {
    toggleInput.disabled = false;
  }
}

toggleInput.addEventListener("change", () => {
  void setEnabled(toggleInput.checked);
});

document.getElementById("open-practice").addEventListener("click", () => {
  void chrome.tabs.create({
    url: chrome.runtime.getURL("practice/practice.html"),
  });
});

document.getElementById("open-fixture").addEventListener("click", () => {
  void chrome.tabs.create({
    url: chrome.runtime.getURL("fixtures/acceptance.html"),
  });
});

input.addEventListener("input", () => {
  save.disabled = input.value.trim().length === 0;
});

save.addEventListener("click", () => {
  const value = input.value.trim();
  if (!value) return;
  StorageHelper.setApiKey(value)
    .then(() => {
      input.value = "";
      save.disabled = true;
      renderKey(value);
    })
    .catch((e) => {
      console.error("[exam-helper] 保存密钥失败：", e);
      meta.classList.remove("ok");
      meta.textContent = "保存失败，请重试";
    });
});

async function load() {
  try {
    const [nextEnabled, key] = await Promise.all([
      StorageHelper.getEnabled(),
      StorageHelper.getApiKey(),
    ]);
    renderEnabled(nextEnabled);
    renderKey(key);
  } catch (e) {
    console.error("[exam-helper] popup 读取状态失败：", e);
    renderEnabled(false);
    renderKey("");
  }
}

try {
  watchLocalStorage((changes) => {
    if (changes[STORAGE_KEYS.enabled]) {
      renderEnabled(!!changes[STORAGE_KEYS.enabled].newValue);
    }
    if (changes[STORAGE_KEYS.apiKey]) {
      renderKey(changes[STORAGE_KEYS.apiKey].newValue || "");
    }
  });
} catch (e) {
  /* storage 监听不可用时忽略 */
}

void load();
