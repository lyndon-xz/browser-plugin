/*
 * 弹窗里的卡片列表。渲染纯粹由传入的 cards 决定，删除交给调用方——
 * 这样它在 jsdom 里可测，不必碰 chrome.*。
 */

const ALL = "__all__";

function miniPair(card) {
  const mini = document.createElement("div");
  mini.className = "mini";

  const then = document.createElement("div");
  then.className = "m-then";
  then.append(tag("评论时"), document.createTextNode(card.thenCode));

  const now = document.createElement("div");
  now.className = "m-now";
  now.append(
    tag("修正后"),
    // null 表示至今未改动，与 ComparePair、卡片存储同一口径
    document.createTextNode(
      card.nowCode === null ? "至今未改动" : card.nowCode,
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

  const row = document.createElement("article");
  row.className = "card";

  const top = document.createElement("div");
  top.className = "card-top";
  const symbol = document.createElement("span");
  symbol.className = "card-symbol";
  symbol.textContent = card.symbol;
  const repo = document.createElement("span");
  repo.className = "card-repo";
  repo.textContent = card.source.project;
  top.append(symbol, repo);

  const note = document.createElement("p");
  note.className = "card-note";
  note.textContent = card.note || card.comment.body;

  const foot = document.createElement("div");
  foot.className = "card-foot";

  // 有的卡片没有 webUrl，缺了就不给这个按钮，不给一个点了跳到 undefined 的链接
  const back = card.source.webUrl ? document.createElement("a") : null;
  if (back) {
    back.className = "mini-btn";
    back.href = card.source.webUrl;
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
      await onDelete(card.id);
    } catch (error) {
      // 删不掉要说话：否则行留在原地、按钮永久禁用，看起来像卡住了
      remove.disabled = false;
      remove.textContent = "删除失败";
      remove.title = error.message;
    }
  });

  foot.append(...[back, remove].filter(Boolean));
  row.append(top, note, miniPair(card), foot);
  return row;
}

function emptyState(title = "还没有卡片") {
  const box = document.createElement("div");
  box.className = "empty";

  const rail = document.createElement("span");
  rail.className = "empty-rail";

  const heading = document.createElement("strong");
  heading.textContent = title;

  const detail = document.createElement("p");
  detail.textContent = "在 GitLab 的代码评论旁点「解读」，看懂一条就存下来。";

  box.append(rail, heading, detail);
  return box;
}

export function renderCardList(root, request) {
  const { cards, onDelete } = request;

  let filter = ALL;

  function draw() {
    root.replaceChildren();

    // 0 张卡片时筛选条与列表都是死控件，只留一句结论加一句怎么做
    if (!cards.length) {
      root.append(emptyState());
      return;
    }

    const projects = [...new Set(cards.map((card) => card.source.project))];
    const filters = document.createElement("div");
    filters.className = "filters";

    for (const [value, label] of [
      [ALL, "全部"],
      ...projects.map((project) => [project, project]),
    ]) {
      const count =
        value === ALL
          ? cards.length
          : cards.filter((card) => card.source.project === value).length;
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
        : cards.filter((card) => card.source.project === filter);
    if (!shown.length) {
      root.append(emptyState("这个仓库还没有卡片"));
      return;
    }

    const list = document.createElement("div");
    list.className = "list";
    for (const card of shown) list.append(cardRow(card, { onDelete }));
    root.append(list);
  }

  draw();
}
