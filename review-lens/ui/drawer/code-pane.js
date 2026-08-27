import { tokenizeJava } from "../../core/code/highlight.js";

/*
 * 代码栏。三个视觉通道互不覆盖：行底色 = diff 增删、左侧竖脊 = 评论锚点、
 * 行内虚线框 = 评论所指的行。代码内容一律用 textContent 写入，宿主页的代码不可信。
 */

/** 代码栏的两侧。两端各写字面量时拼错不报错，只是静默不着色 */
export const PANE_SIDE = { then: "then", now: "now" };

// 每一侧读哪个行号字段、标哪类改动、加哪个 class 都集中在这一处
const SIDE = {
  [PANE_SIDE.then]: {
    lineKey: "thenLine",
    opType: "remove",
    className: "removed",
  },
  [PANE_SIDE.now]: { lineKey: "nowLine", opType: "add", className: "added" },
};

/*
 * diffOps 带的是文件绝对行号，直接按行号对号即可。基准固定为方法体，
 * 因此「上下各多看几行」扩出来的上下文行不在集合里。
 */
function changedRows(diffOps, side) {
  if (!diffOps?.length) {
    return new Set();
  }

  const { lineKey, opType } = SIDE[side];
  const changed = new Set();
  for (const op of diffOps) {
    if (op.type !== opType) {
      continue;
    }
    changed.add(op[lineKey]);
  }
  return changed;
}

// 一行代码分两层着色：语法着色管「这是什么」，命中底色（.hit）管「评论提到的就是这个」
function writeSource(target, text, hitIdentifiers) {
  const matched = hitIdentifiers
    .filter((hit) => text.includes(hit))
    .sort((a, b) => b.length - a.length)[0];

  if (!matched) {
    appendTokens(target, text);
    return;
  }

  const at = text.indexOf(matched);
  appendTokens(target, text.slice(0, at));

  const mark = document.createElement("span");
  mark.className = "hit";
  appendTokens(mark, matched);
  target.append(mark);

  // 同一行里出现两次也都标上
  const rest = document.createElement("span");
  writeSource(rest, text.slice(at + matched.length), hitIdentifiers);
  target.append(rest);
}

function appendTokens(target, text) {
  for (const token of tokenizeJava(text)) {
    if (token.kind === "plain") {
      target.append(document.createTextNode(token.text));
      continue;
    }
    const span = document.createElement("span");
    span.className = `t-${token.kind}`;
    span.textContent = token.text;
    target.append(span);
  }
}

function renderLine(line, context) {
  const { number, text } = line;
  const { anchorLine, changedLines, changeType, hitIdentifiers } = context;

  const row = document.createElement("div");
  row.className = "code-line";
  row.dataset.line = String(number);
  if (number === anchorLine) {
    row.classList.add("anchor");
  }
  if (changedLines.has(number)) {
    row.classList.add(changeType);
  }

  const gutter = document.createElement("span");
  gutter.className = "ln";
  gutter.textContent = String(number);

  const source = document.createElement("span");
  source.className = "src";
  writeSource(source, text, hitIdentifiers);

  row.append(gutter, source);
  return row;
}

export function renderCodePane(snapshot, options) {
  const { label, side, diffOps, hitIdentifiers = [] } = options;

  const pane = document.createElement("section");
  pane.className = `pane ${side}`;

  const head = document.createElement("header");
  head.className = "pane-head";
  const left = document.createElement("span");
  left.textContent = label;
  const right = document.createElement("span");
  right.textContent = `行 ${snapshot.rangeStart}–${snapshot.rangeEnd}`;
  head.append(left, right);

  const code = document.createElement("div");
  code.className = "code";
  const changedLines = changedRows(diffOps, side);
  for (const line of snapshot.lines) {
    code.append(
      renderLine(line, {
        anchorLine: snapshot.anchorLine,
        changedLines,
        changeType: SIDE[side].className,
        hitIdentifiers,
      }),
    );
  }

  pane.append(head, code);
  return pane;
}
