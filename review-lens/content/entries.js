/*
 * 「解读」入口：挂在宿主页的每条代码评审主题旁。这一层只认 DOM，不认识 GitLab API——
 * 点击时只把 discussionId 交出去，代码一律走 API 取，不从宿主页读 diff 文本。
 */

const ENTRY_CLASS = "review-lens-entry";

const DISCUSSION_SELECTOR = "[data-discussion-id]";
const ACTIONS_SELECTOR = ".discussion-actions";

function createEntry(discussionId, onOpen) {
  const button = document.createElement("button");
  button.className = ENTRY_CLASS;
  button.type = "button";
  button.style.cssText = [
    "display:inline-flex",
    "gap:5px",
    "align-items:center",
    "height:24px",
    "margin-right:6px",
    "padding:0 8px",
    "font:12px/1 inherit",
    "color:#5a6579",
    "background:#fff",
    "border:1px solid #e4e8f2",
    "border-radius:5px",
    "cursor:pointer",
  ].join(";");

  const brand = document.createElement("span");
  brand.style.cssText =
    "width:3px;height:11px;border-radius:2px;background:linear-gradient(#a8710f 50%,#147b5c 50%)";

  const label = document.createElement("span");
  label.textContent = "解读";

  button.append(brand, label);
  button.addEventListener("click", () => onOpen({ discussionId }));
  return button;
}

/**
 * getCodeDiscussionIds 返回 undefined 时不筛选（取讨论失败时的兜底）；
 * onDiscussionsMaybeStale 在 DOM 出现未知 discussionId 时触发，便于 reload 后补挂入口。
 */
export function attachEntries(request) {
  const { root, getCodeDiscussionIds, onDiscussionsMaybeStale, onOpen } = request;

  for (const leftover of root.querySelectorAll(`.${ENTRY_CLASS}`)) {
    leftover.remove();
  }

  const STALE_RELOAD_MS = 300;
  let staleReloadTimer = null;
  let staleReloadChain = Promise.resolve();

  function scheduleStaleReload() {
    if (!onDiscussionsMaybeStale) {
      return;
    }
    clearTimeout(staleReloadTimer);
    staleReloadTimer = setTimeout(() => {
      staleReloadChain = staleReloadChain
        .then(() => onDiscussionsMaybeStale())
        .then(() => scan())
        .catch((error) => {
          console.warn("[review-lens] 讨论列表刷新失败：", error);
        });
    }, STALE_RELOAD_MS);
  }

  function attachTo(box) {
    const { discussionId } = box.dataset;
    const codeDiscussionIds = getCodeDiscussionIds?.();
    if (codeDiscussionIds && !codeDiscussionIds.has(discussionId)) {
      scheduleStaleReload();
      return;
    }
    if (box.querySelector(`.${ENTRY_CLASS}`)) {
      return;
    }

    const actions = box.querySelector(ACTIONS_SELECTOR);
    const entry = createEntry(discussionId, onOpen);
    if (actions) {
      actions.prepend(entry);
    } else {
      box.prepend(entry);
    }
  }

  function scan() {
    for (const box of root.querySelectorAll(DISCUSSION_SELECTOR)) {
      attachTo(box);
    }
  }

  scan();

  const SCAN_DEBOUNCE_MS = 80;
  let scanTimer = null;
  const scheduleScan = () => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, SCAN_DEBOUNCE_MS);
  };

  const observer = new MutationObserver(scheduleScan);
  observer.observe(root, { childList: true, subtree: true });

  return () => {
    clearTimeout(scanTimer);
    clearTimeout(staleReloadTimer);
    observer.disconnect();
    for (const entry of root.querySelectorAll(`.${ENTRY_CLASS}`)) {
      entry.remove();
    }
  };
}
