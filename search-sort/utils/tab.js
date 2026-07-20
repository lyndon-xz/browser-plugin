// 标签页操作相关工具。依赖 chrome.tabs，仅供 background / popup 使用，
// 不应注入到内容脚本（content script）环境。

// 判断两个 URL 是否仅参数顺序不同（参数集合完全相同）
function isOnlyReorder(oldURL, newURL) {
  const normalize = (u) =>
    [...new URL(u).searchParams.entries()].sort().toString();
  return normalize(oldURL) === normalize(newURL);
}

// 把排序后的 URL 应用到指定标签页：
// - 与原 URL 相同：不处理
// - 仅参数顺序变化：通知 content script 原地软更新（replaceState）
// - 实质变化（注入默认值/增删参数）：整页刷新
async function applyURLToTab(urlUpdate) {
  const { tabId, oldURL, newURL, config } = urlUpdate;
  if (newURL === oldURL) return;

  if (isOnlyReorder(oldURL, newURL)) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: "apply", config });
    } catch (e) {
      // content script 可能尚未就绪，属预期情况，仅记录便于排查
      console.debug("sendMessage to content script failed:", e);
    }
  } else {
    chrome.tabs.update(tabId, { url: newURL });
  }
}
