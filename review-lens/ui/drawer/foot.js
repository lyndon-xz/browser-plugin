import { relatedLines } from "../../core/comment/related.js";

/*
 * 底栏：扩大范围、相关行、笔记、存卡片。笔记与「已存」的值由编排层持有，这里只读传入的
 * 当前值、改动时用回调交回去——render 会清空重建，状态留在 DOM 上切个视图就丢了。
 */

// 点一次多看多少行。按钮文案与扩展逻辑共用这一个值
const WIDEN_STEP = 10;

function renderRelatedPopover(request) {
  const { anchor, candidates, onFlashLine } = request;

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
      onFlashLine(candidate.line);
      pop.remove();
    });
    pop.append(item);
  }

  anchor.append(pop);
}

// 卡片是自洽的：离开这条 MR 之后，光看卡片也能想起当时读懂了什么
function cardFrom(state, site, note) {
  const { thread } = state;

  return {
    source: {
      // origin 由调用方通过 site 注入，这里再读一次全局就是第二个来源
      origin: site?.origin,
      path: thread.path,
      line: thread.anchorLine,
      discussionId: thread.discussionId,
      // 回链要锚到具体这条评论，拼装交给知道 MR 路径的调用方
      noteId: thread.noteId,
    },
    symbol: `${thread.path}:${thread.anchorLine}`,
    comment: {
      author: thread.author,
      createdAt: thread.createdAt,
      body: thread.body,
    },
    replies: thread.replies ?? [],
    thenCode: state.then.lines.map((line) => line.text).join("\n"),
    // null 表示没有第二份代码可存：至今未改动，或当前分支上已定位不到
    nowCode: state.now ? state.now.lines.map((line) => line.text).join("\n") : null,
    note,
  };
}

function renderWidenButtons(request) {
  const { extraLines, isWholeMethod, onWiden } = request;

  const buttons = [];

  // 点一次范围只会变大；已经扩过才出现回退按钮
  const widen = document.createElement("button");
  widen.type = "button";
  widen.className = "btn btn-widen";
  widen.textContent = `上下各多看 ${WIDEN_STEP} 行`;
  widen.addEventListener("click", () => onWiden(extraLines + WIDEN_STEP));
  buttons.push(widen);

  if (extraLines) {
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "btn btn-reset";
    reset.textContent = isWholeMethod ? "回到这个方法" : "回到评论附近";
    reset.addEventListener("click", () => onWiden(0));
    buttons.push(reset);
  }
  return buttons;
}

function renderSaveButton(request) {
  const { state, site, savedCardId, readNote, onSaveCard, onSaved } = request;

  const save = document.createElement("button");
  save.type = "button";
  save.className = "btn btn-save primary";
  save.textContent = savedCardId ? "已存" : "存为学习卡片";
  save.disabled = Boolean(savedCardId);

  save.addEventListener("click", async () => {
    // 连点两次只该存一条：先锁入口，再发请求
    if (save.disabled) {
      return;
    }
    save.disabled = true;

    try {
      const card = await onSaveCard(cardFrom(state, site, readNote()));
      // 交回编排层记住，否则下一次重绘按钮又可点，能存出第二张卡
      onSaved(card?.id ?? state.savedCardId ?? true);
      save.textContent = "已存";
    } catch {
      // 存储失败要告知用户，不能让人以为存好了
      save.textContent = "存储失败，再试一次";
      save.disabled = false;
    }
  });
  return save;
}

/** 只放此刻真有内容可给的入口：没有相关行就不出那个按钮 */
export function renderFoot(request) {
  const {
    state,
    site,
    note,
    savedCardId,
    onWiden,
    onNoteChange,
    onSaveCard,
    onSaved,
    onFlashLine,
  } = request;

  const foot = document.createElement("footer");
  foot.className = "drawer-foot";

  foot.append(
    ...renderWidenButtons({
      extraLines: state.extraLines ?? 0,
      isWholeMethod: state.then.isWholeMethod,
      onWiden,
    }),
  );

  const candidates = relatedLines({
    body: state.thread.body,
    lines: state.then.lines,
    anchorLine: state.thread.anchorLine,
  });

  if (candidates.length) {
    // 浮层挂在这个容器里，位置跟着按钮走
    const anchor = document.createElement("span");
    anchor.className = "related-anchor";

    const related = document.createElement("button");
    related.type = "button";
    related.className = "btn btn-related";
    related.textContent = `相关行 ${candidates.length}`;
    related.addEventListener("click", () => {
      // 再点一次收起：浮层就挂在 anchor 里，不必去整个抽屉里找
      const existing = anchor.querySelector(".related-pop");
      if (existing) {
        existing.remove();
      } else {
        renderRelatedPopover({ anchor, candidates, onFlashLine });
      }
    });

    anchor.append(related);
    foot.append(anchor);
  }

  const noteInput = document.createElement("input");
  noteInput.className = "note-input";
  noteInput.type = "text";
  noteInput.placeholder = "记一句自己的话，存进学习卡片";
  noteInput.value = note;
  noteInput.addEventListener("input", () => onNoteChange(noteInput.value));
  foot.append(noteInput);

  foot.append(
    renderSaveButton({
      state,
      site,
      savedCardId: savedCardId ?? state.savedCardId,
      // 存的是点下按钮那一刻的笔记，不是渲染这一刻的
      readNote: () => noteInput.value,
      onSaveCard,
      onSaved,
    }),
  );

  return foot;
}
