/**
 * popup.js：读取并展示当前启用状态（非核心路径，随参考项目结构提供）。
 * 状态由 Alt+Q 快捷键切换（见 background.js）；此处只读展示。
 */
(function () {
  "use strict";

  const dot = document.getElementById("dot");
  const statusText = document.getElementById("status-text");

  function render(enabled) {
    dot.classList.toggle("on", enabled);
    dot.classList.toggle("off", !enabled);
    statusText.textContent = enabled ? "已启用（自动匹配中）" : "已禁用";
  }

  async function load() {
    try {
      const result = await chrome.storage.local.get("enabled");
      const enabled =
        typeof result.enabled === "boolean" ? result.enabled : true;
      render(enabled);
    } catch (e) {
      render(true);
    }
  }

  load();
})();
