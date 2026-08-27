/**
 * popup.js：启用状态展示 + 本机 DeepSeek 密钥配置（V-8）。
 */
(function () {
  "use strict";

  const statusEl = document.getElementById("status");
  const statusText = document.getElementById("status-text");
  const input = document.getElementById("key");
  const save = document.getElementById("save");
  const well = document.getElementById("well");
  const meta = document.getElementById("meta");

  function maskTail(key) {
    const tail = String(key).slice(-4);
    return "已保存在本机 · sk-••••" + tail;
  }

  function renderEnabled(enabled) {
    statusEl.classList.toggle("off", !enabled);
    statusText.textContent = enabled ? "已启用 · 自动匹配中" : "已禁用";
  }

  function renderKey(key) {
    if (key) {
      well.classList.add("saved");
      meta.classList.add("ok");
      meta.textContent = maskTail(key);
    } else {
      well.classList.remove("saved");
      meta.classList.remove("ok");
      meta.textContent = "还没填 — 题库没有的题暂时没法问 AI";
    }
  }

  input.addEventListener("input", function () {
    save.disabled = input.value.trim().length === 0;
  });

  save.addEventListener("click", function () {
    const value = input.value.trim();
    if (!value) return;
    StorageHelper.setApiKey(value).then(function () {
      input.value = "";
      save.disabled = true;
      renderKey(value);
    });
  });

  async function load() {
    try {
      const enabled = await StorageHelper.getEnabled();
      const key = await StorageHelper.getApiKey();
      renderEnabled(enabled);
      renderKey(key);
    } catch (e) {
      renderEnabled(true);
      renderKey("");
    }
  }

  load();
})();
