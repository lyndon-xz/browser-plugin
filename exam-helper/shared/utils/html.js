/** 去掉手册条文序号前缀（如 8.【推荐】→【推荐】），与卷内题号无关 */
export function formatExplain(str) {
  return String(str ?? "").replace(/^\d+\.(?=【)/, "");
}

export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
