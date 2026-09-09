import { asDate } from "../core/date.js";
import { toMarkdown } from "../core/export.js";
import { MESSAGE_ACTION, ask } from "../core/platform/messages.js";

import { projectLabel, renderCardList } from "./cards.js";
import { renderEmptyState } from "./empty.js";

const root = document.getElementById("cards");
const tally = document.getElementById("tally");
const exportButton = document.getElementById("export");

// 卡片是这个页面的唯一数据源：删除后要从这里去掉，否则筛选一次被删的就复活了
let cards = [];

function draw() {
  const projects = new Set(cards.map(projectLabel));
  tally.textContent = `${cards.length} 张卡片 · ${projects.size} 个仓库`;
  // 没有卡片时导出按钮按了也只会产出一份空文档，直接不给
  exportButton.hidden = cards.length === 0;

  renderCardList(root, {
    cards,
    onDelete: async (id) => {
      await ask(MESSAGE_ACTION.deleteCard, { id });
      cards = cards.filter((card) => card.id !== id);
      draw();
    },
  });
}

exportButton.addEventListener("click", () => {
  const blob = new Blob([toMarkdown(cards)], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `review-lens-${asDate(new Date().toISOString())}.md`;
  link.click();

  // 下载还没启动就回收会偶发拿到空文件，让出一轮再撤销
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

/*
 * 顶层 await 抛出会中止整个模块，弹窗只剩一个空壳；
 * service worker 冷启动或被终止时会返回 message port closed，这是常态。
 */
try {
  cards = await ask(MESSAGE_ACTION.listCards);
  draw();
} catch (error) {
  tally.textContent = "读不到卡片";
  exportButton.hidden = true;
  root.replaceChildren(
    renderEmptyState({
      title: "打不开卡片列表",
      detail: `${error.message}。关掉这个弹窗再打开一次通常就好了。`,
    }),
  );
}
