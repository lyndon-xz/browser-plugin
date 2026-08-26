import { COMPARE_STATE } from "../../core/compare.js";

import { asDate } from "./date.js";

/*
 * 结论区：顶栏、徽标、在看哪一段的说明，以及右侧没有代码可给时的那段结论。
 * 全是纯函数，只有顶栏需要一个关闭回调。
 */

export function renderHead(request) {
  const { thread, onClose } = request;

  const head = document.createElement("header");
  head.className = "drawer-head";

  const symbol = document.createElement("span");
  symbol.className = "symbol";
  // 取讨论就失败时还不知道这条评论指向哪个文件，顶栏退到产品名
  symbol.textContent = thread ? thread.path.split("/").at(-1) : "review-lens";

  const path = document.createElement("span");
  path.className = "path";
  path.textContent = thread?.path ?? "";

  const closeButton = document.createElement("button");
  closeButton.className = "drawer-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "关闭");
  closeButton.textContent = "✕";
  closeButton.addEventListener("click", onClose);

  head.append(symbol, path, closeButton);
  return head;
}

/** 在看哪一段、多少行、有几行改动，直接写出来而不让读者自己数 */
export function describeSelection(state) {
  const { then, diffOps } = state;

  const scope = then.methodName
    ? `${then.methodName}()`
    : then.path.split("/").at(-1);
  const span = `${then.rangeStart}–${then.rangeEnd} 行`;
  /*
   * 一处修改会同时产生 remove 与 add 两个 op，直接数 op 个数会把「改了 1 行」说成 2 行，
   * 所以取两侧受影响行数的较大值。
   */
  const ops = diffOps ?? [];
  const changedLineCount = Math.max(
    ops.filter((op) => op.type === "remove").length,
    ops.filter((op) => op.type === "add").length,
  );

  return changedLineCount
    ? `${scope} · ${span} · ${changedLineCount} 行有改动`
    : `${scope} · ${span}`;
}

/*
 * 徽标只承担文字，用中性色：那套颜色语义依赖上下、左右的空间位置，徽标没有位置。
 * 比较结果还没拿到时退化成评论自己知道的那一条。
 */
const BADGES = {
  [COMPARE_STATE.changed]: "评论后代码已改动",
  [COMPARE_STATE.unchanged]: "至今未改动",
  [COMPARE_STATE.unlocatable]: "代码已不在当前分支",
};

export function badgeFor(state) {
  if (state.state) return BADGES[state.state] ?? null;
  return state.thread.isOutdated ? BADGES[COMPARE_STATE.changed] : null;
}

// 评论之后动过这个文件的提交只列最近几条：给的是线索，不是完整提交历史
const RECENT_COMMITS = 5;

function renderCommitTrail(commits) {
  const list = document.createElement("ul");
  list.className = "commit-trail";

  for (const commit of commits.slice(0, RECENT_COMMITS)) {
    const item = document.createElement("li");

    const link = document.createElement("a");
    link.href = commit.web_url ?? "#";
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = commit.title ?? commit.id?.slice(0, 8) ?? "提交";

    const who = document.createElement("span");
    who.className = "commit-who";
    who.textContent = `${commit.author_name ?? "?"} · ${asDate(commit.created_at ?? commit.committed_date)}`;

    item.append(link, who);
    list.append(item);
  }
  return list;
}

/** 右侧没有代码可给的两种情形，各自给出结论与出口 */
export function renderNoCode(state) {
  const box = document.createElement("div");
  box.className = "untouched";

  const title = document.createElement("strong");
  const detail = document.createElement("p");

  if (state.state === COMPARE_STATE.unlocatable) {
    title.textContent = "这段代码已经不在当前分支上了";
    detail.textContent = state.commits?.length
      ? "方法被改名、挪走或删除了。这里不猜它变成了什么，但可以告诉你评论之后谁动过这个文件："
      : "方法被改名、挪走或删除了，而且没查到评论之后针对这个文件的提交记录。";

    box.append(title, detail);
    if (state.commits?.length) box.append(renderCommitTrail(state.commits));
    return box;
  }

  title.textContent = "这段代码至今没有改动";
  // 结论在前、依据在后。提交数来自带 path 过滤的查询，指的是动过这个文件的提交
  const touched = state.commits?.length ?? 0;
  // 不提「左边」：布局可切，方位不是固定事实
  detail.textContent =
    "这段代码就是当前分支上的样子，评论提的问题现在仍然成立。" +
    (touched
      ? `评论之后有 ${touched} 个提交动过这个文件，但没有动到这段代码。`
      : "评论之后这个文件没有任何提交。");

  box.append(title, detail);
  return box;
}
