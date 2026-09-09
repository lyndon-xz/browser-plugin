import { UNLOCATABLE_SHORT } from "../core/compare-copy.js";
import { COMPARE_STATE } from "../core/compare.js";

/*
 * 弹窗里的卡片列表。渲染纯粹由传入的 cards 决定，删除交给调用方——
 * 这样它在 jsdom 里可测，不必碰 chrome.*。
 */

const ALL = "__all__";

const EMPTY_HINT = "在 GitLab 的代码评论旁点「解读」，看懂一条就存下来。";

export function renderEmptyState(request) {
  const { title = "还没有卡片", detail } = request;

  const box = document.createElement("div");
  box.className = "empty";

  const rail = document.createElement("span");
  rail.className = "empty-rail";

  const heading = document.createElement("strong");
  heading.textContent = title;

  const body = document.createElement("p");
  body.textContent = detail;

  box.append(rail, heading, body);
  return box;
}
const PREVIEW_MAX_CHARS = 240;

function previewText(text) {
  if (!text) {
    return "";
  }
  if (text.length <= PREVIEW_MAX_CHARS) {
    return text;
  }
  return `${text.slice(0, PREVIEW_MAX_CHARS)}…`;
}

export const projectLabel = (card) =>
  card.source.projectPath ?? decodeURIComponent(card.source.project ?? "");

function nowCaption(card) {
  const { nowCode, compareState } = card;

  if (compareState === COMPARE_STATE.unlocatable) {
    return UNLOCATABLE_SHORT;
  }
  if (nowCode === null || compareState === COMPARE_STATE.unchanged) {
    return "至今未改动";
  }
  return nowCode;
}

function miniPair(card) {
  const mini = document.createElement("div");
  mini.className = "mini";

  const then = document.createElement("div");
  then.className = "m-then";
  then.append(tag("评论时"), document.createTextNode(previewText(card.thenCode)));

  const now = document.createElement("div");
  now.className = "m-now";
  const nowText = nowCaption(card);
  now.append(
    tag("修正后"),
    document.createTextNode(
      nowText === card.nowCode ? previewText(nowText) : nowText,
    ),
  );

  mini.append(then, now);
  return mini;
}

function tag(text) {
  const span = document.createElement("span");
  span.className = "tag";
  span.textContent = text;
  return span;
}

function cardRow(card, handlers) {
  const { onDelete } = handlers;
  const { symbol, source, note, comment, id } = card;

  const row = document.createElement("article");
  row.className = "card";

  const top = document.createElement("div");
  top.className = "card-top";
  const symbolEl = document.createElement("span");
  symbolEl.className = "card-symbol";
  symbolEl.textContent = symbol;
  const repo = document.createElement("span");
  repo.className = "card-repo";
  repo.textContent = projectLabel(card);
  top.append(symbolEl, repo);

  const noteEl = document.createElement("p");
  noteEl.className = "card-note";
  noteEl.textContent =
    note != null && note !== "" ? note : comment.body;

  const foot = document.createElement("div");
  foot.className = "card-foot";

  // 有的卡片没有 webUrl，缺了就不给这个按钮，不给一个点了跳到 undefined 的链接
  const back = source.webUrl ? document.createElement("a") : null;
  if (back) {
    back.className = "mini-btn";
    back.href = source.webUrl;
    back.target = "_blank";
    back.rel = "noreferrer";
    back.textContent = "回到 MR";
  }

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "mini-btn danger";
  remove.textContent = "删除";
  remove.addEventListener("click", async () => {
    remove.disabled = true;
    try {
      // 调用方删完会重绘整份列表，这里不必自己摘节点
      await onDelete(id);
    } catch (error) {
      // 删不掉要说话：否则行留在原地、按钮永久禁用，看起来像卡住了
      remove.disabled = false;
      remove.textContent = "删除失败";
      remove.title = error.message;
    }
  });

  foot.append(...[back, remove].filter(Boolean));
  row.append(top, noteEl, miniPair(card), foot);
  return row;
}

export function renderCardList(root, request) {
  const { cards, onDelete } = request;

  let filter = ALL;

  function draw() {
    root.replaceChildren();

    // 0 张卡片时筛选条与列表都是死控件，只留一句结论加一句怎么做
    if (!cards.length) {
      root.append(renderEmptyState({ title: "还没有卡片", detail: EMPTY_HINT }));
      return;
    }

    const projects = [...new Set(cards.map(projectLabel))];
    const filters = document.createElement("div");
    filters.className = "filters";

    for (const [value, label] of [
      [ALL, "全部"],
      ...projects.map((project) => [project, project]),
    ]) {
      const count =
        value === ALL
          ? cards.length
          : cards.filter((card) => projectLabel(card) === value).length;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.setAttribute("aria-pressed", String(filter === value));
      chip.textContent = `${label.split("/").at(-1)} ${count}`;
      chip.addEventListener("click", () => {
        filter = value;
        draw();
      });
      filters.append(chip);
    }
    root.append(filters);

    const shown =
      filter === ALL
        ? cards
        : cards.filter((card) => projectLabel(card) === filter);
    if (!shown.length) {
      root.append(
        renderEmptyState({
          title: "这个仓库还没有卡片",
          detail: EMPTY_HINT,
        }),
      );
      return;
    }

    const list = document.createElement("div");
    list.className = "list";
    for (const card of shown) {
      list.append(cardRow(card, { onDelete }));
    }
    root.append(list);
  }

  draw();
}
