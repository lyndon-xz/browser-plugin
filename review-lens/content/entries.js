/*
 * 「解读」入口：挂在宿主页的每条代码评审主题旁。这一层只认 DOM，不认识 GitLab API——
 * 点击时只把 discussionId 交出去，代码一律走 API 取，不从宿主页读 diff 文本。
 */

const ENTRY_CLASS = "review-lens-entry";

// 锚点取讨论容器而不是评论节点：主题折叠时容器内没有 note 元素，.discussion-actions 始终存在
const DISCUSSION_SELECTOR = "[data-discussion-id]";
const ACTIONS_SELECTOR = ".discussion-actions";

/*
 * 按钮挂在宿主页里、拿不到抽屉那份 Shadow DOM 样式，只能用内联样式；
 * 用内联而不是往宿主页插 <style>，是为了不在宿主页留下痕迹。
 */
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
 * codeDiscussionIds 是 API 认定含代码评论的讨论集合，MR 概览区的普通讨论不会挂上入口；
 * 省略该参数则给所有讨论容器挂上，取讨论失败时用它兜底。返回值是卸载函数。
 */
export function attachEntries(request) {
  const { root, codeDiscussionIds, onOpen } = request;

  function attachTo(box) {
    const { discussionId } = box.dataset;
    if (codeDiscussionIds && !codeDiscussionIds.has(discussionId)) {
      return;
    }
    if (box.querySelector(`.${ENTRY_CLASS}`)) {
      return;
    }

    const actions = box.querySelector(ACTIONS_SELECTOR);
    const entry = createEntry(discussionId, onOpen);
    // 放在「显示主题」左边，读者的视线正好落在这里
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

  // 讨论区异步补渲染，展开/折叠主题时也会新增节点
  const observer = new MutationObserver(scan);
  observer.observe(root, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    /*
     * 已挂的按钮也要摘掉：宿主页是客户端路由，节点可能留在文档里，而它们的 click
     * 指向这一轮的闭包（旧 client、旧讨论数据），下一轮挂载又会在同一处再加一个。
     */
    for (const entry of root.querySelectorAll(`.${ENTRY_CLASS}`)) {
      entry.remove();
    }
  };
}
