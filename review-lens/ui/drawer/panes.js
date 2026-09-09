import { CODE_CLASS, PANE_SIDE, codeLineSelector, renderCodePane } from "./code-pane.js";

/*
 * 代码区：两栏本身、上面那条时间脊（视图切换与同步开关），以及滚动相关的四个动作。
 * 视图与同步开关的当前值由编排层持有，改动通过回调交回去。
 */

/** 两种布局。取值用在切换按钮、grid class 与持久化三处，具名避免拼错后静默失效 */
export const VIEW = { stacked: "stacked", side: "side" };

/** 有没有第二份代码：决定右边摆代码还是摆结论，也决定同步滚动有没有施力点 */
export const hasTwoSides = (state) => Boolean(state.now);

function renderViewSwitch(request) {
  const { view, onViewChange } = request;

  const group = document.createElement("div");
  group.className = "view-switch";

  for (const [name, label] of [
    [VIEW.stacked, "上下"],
    [VIEW.side, "并排"],
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.view = name;
    button.textContent = label;
    button.setAttribute("aria-pressed", String(view === name));
    button.addEventListener("click", () => {
      if (view === name) {
        return;
      }
      onViewChange(name);
    });
    group.append(button);
  }
  return group;
}

function renderSyncToggle(request) {
  const { isSyncScrollEnabled, onSyncChange } = request;

  const label = document.createElement("label");
  label.className = "sync-toggle";

  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = isSyncScrollEnabled;
  box.addEventListener("change", () => onSyncChange(box.checked));

  const text = document.createElement("span");
  text.textContent = "同步滚动";

  label.append(box, text);
  return label;
}

/** 时间脊：说清在看哪一段，并放视图切换与同步开关 */
export function renderSpine(request) {
  const { state, selectionText, view, isSyncScrollEnabled, onViewChange, onSyncChange } =
    request;

  const spine = document.createElement("div");
  spine.className = "spine";

  const selectionNote = document.createElement("span");
  selectionNote.className = "spine-note";
  selectionNote.textContent = selectionText;
  // 视图切换排的是两个块，右边是代码还是结论都一样
  spine.append(selectionNote, renderViewSwitch({ view, onViewChange }));
  // 同步滚动要两个都能滚的代码区才有施力点
  if (hasTwoSides(state)) {
    spine.append(renderSyncToggle({ isSyncScrollEnabled, onSyncChange }));
  }

  return spine;
}

/** 右侧没有第二份代码时摆什么，由 renderRight 决定——那是结论区的事 */
export function renderPanes(request) {
  const { state, view, hitIdentifiers, renderRight } = request;

  const wrap = document.createElement("div");
  wrap.className = `panes${view === VIEW.stacked ? " stacked" : ""}`;

  wrap.append(
    renderCodePane(state.then, {
      label: "评论时",
      side: PANE_SIDE.then,
      diffOps: state.diffOps,
      hitIdentifiers,
    }),
  );

  const paneSpine = document.createElement("div");
  paneSpine.className = "pane-spine";
  wrap.append(paneSpine);

  wrap.append(
    hasTwoSides(state)
      ? renderCodePane(state.now, {
          label: "修正后",
          side: PANE_SIDE.now,
          diffOps: state.diffOps,
          hitIdentifiers,
        })
      : renderRight(state),
  );

  return wrap;
}

const codePanesIn = (root) => [...root.querySelectorAll(`.${CODE_CLASS}`)];

export const readScroll = (root) =>
  codePanesIn(root).map((el) => ({
    top: el.scrollTop,
    height: el.scrollHeight,
  }));

/**
 * 换布局后列宽与折行数都变了，同一个像素值不再对应同一行，所以按比例还原；
 * 还没布局、取不到高度时退回像素值。
 */
export function restoreScroll(root, wasAt) {
  codePanesIn(root).forEach((el, index) => {
    const was = wasAt[index];
    if (was?.top == null) {
      return;
    }
    el.scrollTop = was.height ? (was.top / was.height) * el.scrollHeight : was.top;
  });
}

/**
 * 滚到某一行并闪一下。class 靠 animationend 摘掉而不是 setTimeout：动画时长只留在
 * CSS 一处，也不会有抽屉关闭后仍在跑的定时器。
 */
export function flashLine(root, line) {
  const row = root.querySelector(codeLineSelector(line));
  if (!row) {
    return;
  }

  row.scrollIntoView({ block: "center" });
  row.classList.add("flash");
  row.addEventListener("animationend", () => row.classList.remove("flash"), {
    once: true,
  });
}

/**
 * 两栏滚动同步。readSyncing 是取值函数而不是布尔：监听常驻，勾选状态在滚动那一刻才读——
 * 为这个开关重绘会把两侧滚动位置清回开头。isEchoing 挡住回弹，否则两侧互相触发。
 */
export function linkScroll(panes, readSyncing) {
  const [a, b] = panes.querySelectorAll(`.${CODE_CLASS}`);
  if (!a || !b) {
    return;
  }

  let isEchoing = false;
  const scrollRatio = (el) => {
    const range = el.scrollHeight - el.clientHeight;
    return range > 0 ? el.scrollTop / range : 0;
  };
  const link = (from, to) =>
    from.addEventListener("scroll", () => {
      if (!readSyncing() || isEchoing) {
        return;
      }
      isEchoing = true;
      const range = to.scrollHeight - to.clientHeight;
      to.scrollTop = scrollRatio(from) * range;
      requestAnimationFrame(() => {
        isEchoing = false;
      });
    });

  link(a, b);
  link(b, a);
}
