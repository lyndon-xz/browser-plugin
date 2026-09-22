/*
 * 验收页引导：扩展页无法注入 content script，在此直接加载助手。
 */
import { runQuery } from "./entry.js";
import "./page-assist.js";
import {
  STORAGE_KEYS,
  StorageHelper,
  watchLocalStorage,
} from "../../shared/utils/storage.js";

const statusEl = document.getElementById("eh-fixture-status");

function renderStatus(enabled, note = "") {
  if (!statusEl) {
    return;
  }
  statusEl.hidden = false;
  statusEl.classList.toggle("is-on", enabled);
  statusEl.classList.toggle("is-off", !enabled);
  statusEl.innerHTML = enabled
    ? `<strong>划词助手已启用</strong> — 选中文字后查询${note}`
    : `<strong>划词助手未启用</strong> — 请打开 popup 开启${note}`;
}

function showBootError(error) {
  renderStatus(false, "");
  if (statusEl) {
    statusEl.classList.remove("is-on");
    statusEl.classList.add("is-off");
    statusEl.innerHTML = `<strong>助手加载失败</strong> — ${String(error?.message ?? error)}。请在 chrome://extensions 重载扩展。`;
  }
  console.error("[eh] fixture bootstrap:", error);
}

try {
  const queryBtn = document.getElementById("eh-query-btn");
  queryBtn?.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  queryBtn?.addEventListener("click", () => {
    void runQuery();
  });
} catch (error) {
  showBootError(error);
}

void (async () => {
  try {
    renderStatus(await StorageHelper.getEnabled());
  } catch {
    renderStatus(false);
  }
})();

watchLocalStorage((changes) => {
  if (changes[STORAGE_KEYS.enabled]) {
    renderStatus(!!changes[STORAGE_KEYS.enabled].newValue);
  }
});
