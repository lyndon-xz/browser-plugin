/**
 * 扩展自有页面（练习、验收等）加载划词助手。
 * chrome-extension:// 页面不会注入 content script，需在此显式 init。
 */
import { init } from "./entry.js";

let teardown = null;

try {
  teardown = init();
} catch (error) {
  console.error("[eh] page assist:", error);
}

window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    teardown?.();
  }
});
