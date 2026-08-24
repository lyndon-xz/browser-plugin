import { extractIdentifiers, locateIdentifiers } from "../core/identifier.js";
import { splitAttachments } from "../core/attachment.js";
import { COMPARE_STATE } from "../core/compare.js";
import { relatedLines } from "../core/related.js";
import { renderCodePane } from "./code-pane.js";
import { renderFailure } from "./failure.js";

// 自定义标签名当宿主节点，既好定位又不会撞上 GitLab 自己的类名
export const HOST_TAG = "review-lens-drawer";

// 宽度是读代码的核心变量，交给用户拖；但不能拖成一条缝，也不该盖满整页
export const MIN_WIDTH = 420;
export const MAX_WIDTH = 1400;
const DEFAULT_WIDTH = 820;

// styleText 由调用方读 ui/drawer.css 后传进来，这样本模块不依赖 chrome.* 也能测
export function createDrawer({
  styleText,
  // { origin, projectPath }：解析评论里项目相对的 /uploads/ 附件用
  site = null,
  readView = () => null,
  writeView = () => {},
  onWiden = () => {},
  onSaveCard = async () => {},
  readWidth = () => null,
  writeWidth = () => {},
  readSyncScroll = () => null,
  writeSyncScroll = () => {},
}) {
  let host = null;
  let root = null;
  /*
   * 默认上下堆叠（design.md DD-4）：实测并排时每栏只剩约 40 字符，
   * 而 Java 行普遍 60–100 字符，几乎每行都要折行。
   */
  let view = readView() ?? "stacked";
  let width = readWidth() ?? DEFAULT_WIDTH;
  let hostOverflow = null;
  // 默认同步，但两侧行数不同也会错位，所以留一个开关（DD-30、DD-39）
  let syncing = readSyncScroll() ?? true;

  function onKeydown(event) {
    if (event.key === "Escape") close();
  }

  /*
   * 点抽屉以外的任意位置关闭（DD-15）。用 mousedown 而不是 click：宿主页上不少控件会在
   * mousedown 阶段就改动 DOM，等到 click 时事件目标可能已经不在文档里，判不出内外。
   * 事件从 Shadow DOM 冒出来后 target 会变成宿主节点，据此判断点在抽屉内还是外。
   */
  function onPointerDown(event) {
    if (host && !event.composedPath().includes(host)) close();
  }

  /*
   * 左边缘拖拽把手（DD-17）。用 document 上的 mousemove/mouseup 而不是把手自身的，
   * 否则指针一旦移出把手就断掉；松手才写入，免得拖动过程中反复写存储。
   */
  function attachGrip(panel) {
    const gripEl = document.createElement("div");
    gripEl.className = "drawer-grip";
    gripEl.title = "拖动调整宽度";

    gripEl.addEventListener("mousedown", (event) => {
      const startX = event.clientX;
      const startWidth = width;

      const onMove = (move) => {
        // 往左拖变宽：抽屉贴在右边缘
        const next = startWidth + (startX - move.clientX);
        width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next));
        panel.style.width = `${width}px`;
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        writeWidth(width);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      event.preventDefault();
    });

    panel.append(gripEl);
  }

  function mount() {
    host = document.createElement(HOST_TAG);
    root = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = styleText;
    root.append(style);

    document.body.append(host);
    document.addEventListener("keydown", onKeydown);
    document.addEventListener("mousedown", onPointerDown);

    /*
     * 抽屉是当前焦点，背后的页面跟着滚会让人不知道自己在看哪儿（DD-25）。
     * 记下原值而不是假设它是 auto，关闭时才能精确还原、不留痕迹。
     */
    hostOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  function renderHead(thread) {
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
    closeButton.addEventListener("click", close);

    head.append(symbol, path, closeButton);
    return head;
  }

  function describeSelection(state) {
    const { then, diffOps } = state;
    const scope = then.methodName ? `${then.methodName}()` : then.path.split("/").at(-1);
    const span = `${then.rangeStart}–${then.rangeEnd} 行`;
    // 只有两侧都有代码时才谈改动行数
    const changed = (diffOps ?? []).filter((op) => op.type !== "keep").length;

    return changed ? `${scope} · ${span} · ${changed} 行有改动` : `${scope} · ${span}`;
  }

  /*
   * 徽标只承担文字，用中性色（DD-41）：琥珀/青瓷的无歧义性来自空间位置（上下、左右），
   * 徽标没有位置，同一句话有两种都成立的读法，颜色反而稀释了那套语义。
   * 比较结果还没拿到时（loading / failed）退化成评论自己知道的那一条。
   */
  const BADGES = {
    [COMPARE_STATE.changed]: "评论后代码已改动",
    [COMPARE_STATE.unchanged]: "至今未改动",
    [COMPARE_STATE.unlocatable]: "代码已不在当前分支",
  };

  function badgeFor(state) {
    if (state.state) return BADGES[state.state] ?? null;
    return state.thread.outdated ? BADGES[COMPARE_STATE.changed] : null;
  }

  // 只取日期部分：读评审时「哪一天说的」够用，精确到分秒反而占地方
  const asDate = (iso) => String(iso ?? "").slice(0, 10);

  function renderComment(state) {
    const { thread } = state;
    const card = document.createElement("section");
    card.className = "comment-card";

    const top = document.createElement("div");
    top.className = "comment-card-top";

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = thread.author;

    const when = document.createElement("span");
    when.className = "when";
    when.textContent = asDate(thread.createdAt);

    top.append(name, when);

    const flag = badgeFor(state);
    if (flag) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = flag;
      top.append(badge);
    }

    const body = document.createElement("p");
    writeCommentBody(body, thread.body);

    card.append(top, body);
    return card;
  }

  /*
   * 评论正文里提到、且代码里真出现了的标识符渲染成可点 chip。代码里没出现的不做成 chip——
   * 点了没地方可去的链接比没有链接更糟。
   */
  function writeIdentifiers(target, text) {
    const linkable = new Set(activeHits);
    let cursor = 0;

    for (const { text: identifier } of extractIdentifiers(text)) {
      if (!linkable.has(identifier)) continue;

      const at = text.indexOf(identifier, cursor);
      if (at < 0) continue;

      target.append(document.createTextNode(text.slice(cursor, at)));

      const chip = document.createElement("span");
      chip.className = "ident";
      chip.textContent = identifier;
      chip.addEventListener("click", () => jumpTo(identifier));
      target.append(chip);

      cursor = at + identifier.length;
    }
    target.append(document.createTextNode(text.slice(cursor)));
  }

  // 贴在评论里的截图，点开看原图——抽屉的宽度不一定够看清（DD-44）
  function renderShot({ alt, url }) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noreferrer";

    const image = document.createElement("img");
    image.className = "shot";
    image.src = url;
    image.alt = alt || "评论里的截图";
    image.loading = "lazy";

    link.append(image);
    return link;
  }

  // 评论与回复共用：文本段做标识符 chip，附件段渲染成截图
  function writeCommentBody(target, text) {
    for (const piece of splitAttachments(text, site)) {
      if (piece.kind === "image") target.append(renderShot(piece));
      else writeIdentifiers(target, piece.text);
    }
  }

  // 跳到该标识符在代码里出现的第一行，并闪一下——不闪的话读者不知道刚才滚到了哪
  function jumpTo(identifier) {
    const located = locateIdentifiers([identifier], lastState.then.lines)[0];
    const target = located?.lines[0];
    if (!target) return;

    const row = root.querySelector(`.code-line[data-line="${target}"]`);
    if (!row) return;

    row.scrollIntoView({ block: "center" });
    row.classList.add("flash");
    setTimeout(() => row.classList.remove("flash"), 900);
  }

  // 没人回复时整块不渲染，不留空槽
  function renderReplies(replies) {
    if (!replies?.length) return null;

    const list = document.createElement("section");
    list.className = "replies";

    // 有标题读者才知道下面是「对上面那条的回应」，而不是又一条平级评论
    const head = document.createElement("div");
    head.className = "replies-head";
    head.textContent = `回复 · ${replies.length} 条`;
    list.append(head);

    for (const reply of replies) {
      const item = document.createElement("article");
      item.className = "reply";

      const top = document.createElement("div");
      top.className = "reply-top";
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = reply.author;
      const when = document.createElement("span");
      when.className = "when";
      when.textContent = asDate(reply.createdAt);
      top.append(name, when);

      const body = document.createElement("p");
      writeCommentBody(body, reply.body);

      item.append(top, body);
      list.append(item);
    }
    return list;
  }

  // 死胡同变线索：评论之后谁动过这个文件（DD-43）
  // 只列最近几条：这是线索不是提交历史，多了反而找不到重点
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

  // 右侧没有代码可给的两种情形，各说各的话，都给出口
  function renderNoCode(state) {
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
    /*
     * 结论在前、依据在后。依据只有一个来源：评论之后动过这个文件的提交数（DD-49）。
     * 那个查询带 path 过滤，返回的就是动过这个文件的提交，别把它说成「都没碰过」。
     */
    const touched = state.commits?.length ?? 0;
    // 不提「左边」：布局可切，方位不是固定事实（DD-51）
    detail.textContent =
      "这段代码就是当前分支上的样子，评论提的问题现在仍然成立。" +
      (touched
        ? `评论之后有 ${touched} 个提交动过这个文件，但没有动到这段代码。`
        : "评论之后这个文件没有任何提交。");

    box.append(title, detail);
    return box;
  }

  function renderViewSwitch() {
    const group = document.createElement("div");
    group.className = "view-switch";

    for (const [name, label] of [
      ["stacked", "上下"],
      ["side", "并排"],
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.view = name;
      button.textContent = label;
      button.setAttribute("aria-pressed", String(view === name));
      button.addEventListener("click", () => {
        if (view === name) return;

        const wasAt = readScroll();
        view = name;
        writeView(name);
        render(lastState);
        restoreScroll(wasAt);
      });
      group.append(button);
    }
    return group;
  }

  // 签名元素：时间脊，把两个时点绑在一起
  // 有没有第二份代码：决定右边摆代码还是摆结论，也决定同步滚动有没有施力点（DD-48、DD-50）
  const hasTwoSides = (state) => Boolean(state.now);

  function renderSpine(state) {
    const spine = document.createElement("div");
    spine.className = "spine";

    /*
     * 选择逻辑不该靠猜：直接写出在看哪一段、多少行、有几行改动（DD-32）。
     */
    const note = document.createElement("span");
    note.className = "spine-note";
    note.textContent = describeSelection(state);
    // 视图切换排的是「两个块」，右边那个是代码还是结论都一样（DD-50）
    spine.append(note, renderViewSwitch());
    // 同步滚动要两个都能滚的代码区才有施力点
    if (hasTwoSides(state)) spine.append(renderSyncToggle());

    return spine;
  }

  function renderPanes(state) {
    const wrap = document.createElement("div");
    wrap.className = `panes${view === "stacked" ? " stacked" : ""}`;

    wrap.append(
      renderCodePane(state.then, {
        label: "评论时",
        side: "then",
        diffOps: state.diffOps,
        hits: activeHits,
      }),
    );

    const rail = document.createElement("div");
    rail.className = "pane-spine";
    wrap.append(rail);

    wrap.append(
      hasTwoSides(state)
        ? renderCodePane(state.now, {
            label: "修正后",
            side: "now",
            diffOps: state.diffOps,
            hits: activeHits,
          })
        : renderNoCode(state),
    );

    return wrap;
  }

  function renderSyncToggle() {
    const label = document.createElement("label");
    label.className = "sync-toggle";

    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = syncing;
    box.addEventListener("change", () => {
      syncing = box.checked;
      writeSyncScroll(syncing);
    });

    const text = document.createElement("span");
    text.textContent = "同步滚动";

    label.append(box, text);
    return label;
  }

  // 两栏滚动同步；echo 标志挡住回弹，否则两侧会互相推着抖
  const codePanes = () => [...root.querySelectorAll(".code")];

  const readScroll = () => codePanes().map((el) => ({ top: el.scrollTop, height: el.scrollHeight }));

  /*
   * 换布局后列宽变了、折行数也跟着变，同一个像素值不再对应同一行，所以按比例还原（DD-47）。
   * 取不到高度时（还没布局）退回像素值，总比跳回开头好。
   */
  function restoreScroll(wasAt) {
    codePanes().forEach((el, index) => {
      const was = wasAt[index];
      if (!was?.top) return;
      el.scrollTop = was.height ? (was.top / was.height) * el.scrollHeight : was.top;
    });
  }

  function linkScroll(panes) {
    const [a, b] = panes.querySelectorAll(".code");
    if (!a || !b) return;

    let echo = false;
    /*
     * 监听常驻，勾选状态在回调里读（DD-47）。开关不改布局，为它重绘会把两侧
     * 滚动位置一并清回开头——读者刚定位好的那一段就没了。
     */
    const link = (from, to) =>
      from.addEventListener("scroll", () => {
        if (!syncing || echo) return;
        echo = true;
        to.scrollTop = from.scrollTop;
        requestAnimationFrame(() => {
          echo = false;
        });
      });

    link(a, b);
    link(b, a);
  }

  // 底栏：只放此刻真有内容可给的入口
  function renderFoot(state) {
    const foot = document.createElement("footer");
    foot.className = "drawer-foot";

    /*
     * 只有一个单调方向：点一次范围只会变大（DD-35）。
     * 已经扩过才出现「回到这个方法」，否则这个按钮没有意义。
     */
    const widen = document.createElement("button");
    widen.type = "button";
    widen.className = "btn btn-widen";
    widen.textContent = "上下各多看 10 行";
    widen.addEventListener("click", () => onWiden((state.extraLines ?? 0) + 10));
    foot.append(widen);

    if (state.extraLines) {
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "btn btn-reset";
      reset.textContent = state.then.wholeMethod ? "回到这个方法" : "回到评论附近";
      reset.addEventListener("click", () => onWiden(0));
      foot.append(reset);
    }

    const candidates = relatedLines({
      body: state.thread.body,
      lines: state.then.lines,
      anchorLine: state.thread.anchorLine,
    });

    if (candidates.length) {
      // 浮层挂在这个容器里，位置就永远跟着按钮走（DD-37）
      const anchor = document.createElement("span");
      anchor.className = "related-anchor";

      const related = document.createElement("button");
      related.type = "button";
      related.className = "btn btn-related";
      related.textContent = `相关行 ${candidates.length}`;
      related.addEventListener("click", () => togglePopover(anchor, candidates));

      anchor.append(related);
      foot.append(anchor);
    }

    const note = document.createElement("input");
    note.className = "note-input";
    note.type = "text";
    note.placeholder = "记一句自己的话，存进学习卡片";
    foot.append(note);

    const save = document.createElement("button");
    save.type = "button";
    save.className = "btn btn-save primary";
    save.textContent = state.savedCardId ? "已存" : "存为学习卡片";
    save.disabled = Boolean(state.savedCardId);
    save.addEventListener("click", async () => {
      // 连点两次只该存一条：先锁入口，再发请求
      if (save.disabled) return;
      save.disabled = true;

      try {
        await onSaveCard(cardFrom(state, note.value));
        save.textContent = "已存";
      } catch {
        // 存不下要说话，不能让用户以为存好了
        save.textContent = "存储失败，再试一次";
        save.disabled = false;
      }
    });
    foot.append(save);

    return foot;
  }

  // 卡片是自洽的：离开这条 MR 之后，光看卡片也能想起当时读懂了什么
  function cardFrom(state, note) {
    const { thread } = state;
    return {
      source: {
        origin: window.location.origin,
        path: thread.path,
        line: thread.anchorLine,
        discussionId: thread.discussionId,
      },
      symbol: `${thread.path}:${thread.anchorLine}`,
      comment: { author: thread.author, createdAt: thread.createdAt, body: thread.body },
      replies: thread.replies ?? [],
      thenCode: state.then.lines.map((line) => line.text).join("\n"),
      // null 表示没有第二份代码可存：至今未改动，或当前分支上已定位不到
      nowCode: state.now ? state.now.lines.map((line) => line.text).join("\n") : null,
      note,
    };
  }

  function togglePopover(anchor, candidates) {
    const existing = root.querySelector(".related-pop");
    if (existing) {
      existing.remove();
      return;
    }

    const pop = document.createElement("div");
    pop.className = "related-pop";

    const head = document.createElement("h4");
    head.textContent = "评论可能指的是这几行";
    pop.append(head);

    for (const candidate of candidates) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "related-item";

      const number = document.createElement("span");
      number.className = "rl";
      number.textContent = String(candidate.line);

      const why = document.createElement("span");
      why.className = "why";
      why.textContent = candidate.reason;

      item.append(number, why);
      item.addEventListener("click", () => {
        const row = root.querySelector(`.code-line[data-line="${candidate.line}"]`);
        row?.scrollIntoView({ block: "center" });
        row?.classList.add("flash");
        setTimeout(() => row?.classList.remove("flash"), 900);
        pop.remove();
      });
      pop.append(item);
    }

    anchor.append(pop);
  }

  let lastState = null;
  // 评论里提到、且代码里真出现了的标识符：chip 与代码内高亮共用同一份，口径只有一处
  let activeHits = [];

  function render(state) {
    lastState = state;
    activeHits = state.then
      ? locateIdentifiers(
          extractIdentifiers(state.thread?.body).map((item) => item.text),
          state.then.lines,
        )
          .filter((located) => located.lines.length)
          .map((located) => located.text)
      : [];
    if (!host) mount();

    // 只重建内容，样式节点留着，避免每次渲染重新解析 CSS
    for (const node of [...root.children]) {
      if (node.tagName !== "STYLE") node.remove();
    }

    const drawer = document.createElement("aside");
    drawer.className = "drawer";
    drawer.style.width = `${width}px`;
    attachGrip(drawer);
    drawer.append(renderHead(state.thread));
    if (state.thread) {
      drawer.append(renderComment(state));
      const replies = renderReplies(state.thread.replies);
      if (replies) drawer.append(replies);
    }

    if (state.status === "ready") {
      drawer.append(renderSpine(state));
      const panes = renderPanes(state);
      drawer.append(panes);
      // 同步是让两侧停在对应的那段代码上，两种布局都成立（DD-39）
      if (hasTwoSides(state)) linkScroll(panes);
      drawer.append(renderFoot(state));
    }
    if (state.status === "failed") {
      drawer.append(
        renderFailure({
          error: state.error,
          onRetry: state.onRetry,
          onConfigureToken: state.onConfigureToken,
        }),
      );
    }

    root.append(drawer);
  }

  function close() {
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("mousedown", onPointerDown);
    if (hostOverflow !== null) {
      document.body.style.overflow = hostOverflow;
      hostOverflow = null;
    }
    host?.remove();
    host = null;
    root = null;
  }

  return { render, close };
}
