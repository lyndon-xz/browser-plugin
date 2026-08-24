import { tokenizeJava } from "../core/highlight.js";

/*
 * 代码栏。三个视觉通道互不覆盖（design.md DD-3）：
 * 行底色 = diff 增删、左侧竖脊 = 评论锚点、行内虚线框 = 评论真正所指的行。
 * 代码内容一律用 textContent 写入——宿主页的代码不可信。
 */

// 某一侧只标它自己那类改动：旧版本一侧标删除，新版本一侧标新增
const CHANGE_ON = { then: "remove", now: "add" };

/*
 * diffOps 带的是文件绝对行号（compare.js 已换算好），所以这里直接按行号对号即可。
 * 基准固定为方法体，因此「上下各多看几行」扩出来的上下文行天然不在集合里（DD-42）。
 */
function changedRows(diffOps, side) {
  if (!diffOps?.length) return new Set();

  const lineKey = side === "then" ? "thenLine" : "nowLine";
  const changed = new Set();
  for (const op of diffOps) {
    if (op.type !== CHANGE_ON[side]) continue;
    changed.add(op[lineKey]);
  }
  return changed;
}

/*
 * 一行代码分两层着色，互不干扰：语法着色（token）管「这是什么」，
 * 命中底色（.hit）管「评论提到的就是这个」。全部用 textContent 写入——
 * 宿主页的代码不可信，任何时候都不拼 HTML。
 */
function writeSource(target, text, hits) {
  const matched = hits.filter((hit) => text.includes(hit)).sort((a, b) => b.length - a.length)[0];

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
  writeSource(rest, text.slice(at + matched.length), hits);
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

function renderLine({ number, text }, { anchorLine, changed, changeType, hits }) {
  const row = document.createElement("div");
  row.className = "code-line";
  row.dataset.line = String(number);
  if (number === anchorLine) row.classList.add("anchor");
  // changed 里存的是「本侧第几行」，快照行号减去起始偏移即得
  if (changed.has(number)) row.classList.add(changeType);

  const gutter = document.createElement("span");
  gutter.className = "ln";
  gutter.textContent = String(number);

  const source = document.createElement("span");
  source.className = "src";
  writeSource(source, text, hits);

  row.append(gutter, source);
  return row;
}

export function renderCodePane(snapshot, { label, side, diffOps, hits = [] }) {
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
  const changed = changedRows(diffOps, side);
  for (const line of snapshot.lines) {
    code.append(
      renderLine(line, {
        anchorLine: snapshot.anchorLine,
        changed,
        changeType: side === "then" ? "removed" : "added",
        hits,
      }),
    );
  }

  pane.append(head, code);
  return pane;
}
