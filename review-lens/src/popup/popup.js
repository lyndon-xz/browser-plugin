import { toMarkdown } from "../core/export.js";
import { MESSAGE_ACTION, ask } from "../core/messages.js";
import { renderCardList } from "./cards-view.js";

const cards = await ask(MESSAGE_ACTION.listCards);

const projects = new Set(cards.map((card) => card.source.project));
document.getElementById("tally").textContent = `${cards.length} 张卡片 · ${projects.size} 个仓库`;

renderCardList(document.getElementById("cards"), {
  cards,
  onDelete: (id) => ask(MESSAGE_ACTION.deleteCard, { id }),
});

// 没有卡片时导出按钮按了也只会产出一份空文档，直接不给（DD-28）
const exportButton = document.getElementById("export");
exportButton.hidden = cards.length === 0;

exportButton.addEventListener("click", () => {
  const blob = new Blob([toMarkdown(cards)], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `review-lens-${new Date().toISOString().slice(0, 10)}.md`;
  link.click();

  URL.revokeObjectURL(url);
});
