/*
 * 「解读」入口：挂在宿主页的每条代码评审主题旁。这一层只认 DOM，不认识 GitLab API——
 * 点击时只把 discussionId 交出去，代码一律走 API 取，不从宿主页读 diff 文本。
 */

const ENTRY_CLASS = "review-lens-entry";
const BRAND_CLASS = "review-lens-entry-brand";

const DISCUSSION_SELECTOR = "[data-discussion-id]";
const ACTIONS_SELECTOR = ".discussion-actions";

// GitLab MR 讨论列表常见容器，观察范围收窄到此处
const DISCUSSION_ROOT_SELECTORS = [
  "#notes-list",
  ".notes",
  "[data-testid='notes-discussion']",
  ".discussions-list",
];

function findDiscussionRoot(root) {
  for (const selector of DISCUSSION_ROOT_SELECTORS) {
    const node = root.querySelector(selector);
    if (node) {
      return node;
    }
  }
  return root;
}

function createEntry(discussionId, onOpen) {
  const button = document.createElement("button");
  button.className = ENTRY_CLASS;
  button.type = "button";
  button.setAttribute("aria-label", "解读这条代码评论");

  const brand = document.createElement("span");
  brand.className = BRAND_CLASS;

  const label = document.createElement("span");
  label.textContent = "解读";

  button.append(brand, label);
  button.addEventListener("click", () => onOpen({ discussionId }));
  return button;
}

/**
 * getCodeDiscussionIds 返回 null 时不挂入口（取讨论失败）；
 * 返回 Set 时只挂代码评论；onDiscussionsMaybeStale 在 DOM 出现未知 discussionId 时触发。
 */
export function attachEntries(request) {
  const { root, getCodeDiscussionIds, onDiscussionsMaybeStale, onOpen } =
    request;
  const observeRoot = findDiscussionRoot(root);

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
    if (codeDiscussionIds === null) {
      return;
    }
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
    for (const box of observeRoot.querySelectorAll(DISCUSSION_SELECTOR)) {
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
  observer.observe(observeRoot, { childList: true, subtree: true });

  return () => {
    clearTimeout(scanTimer);
    clearTimeout(staleReloadTimer);
    observer.disconnect();
    for (const entry of root.querySelectorAll(`.${ENTRY_CLASS}`)) {
      entry.remove();
    }
  };
}
