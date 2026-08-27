import { splitAttachments } from "../../core/comment/attachment.js";
import { extractIdentifiers } from "../../core/comment/identifier.js";

import { asDate } from "./date.js";

/*
 * 评论与回复的渲染。两个导出都是纯函数：不持有状态，正文里的标识符能不能点由
 * hitIdentifiers 决定，点了跳哪儿由 onJumpTo 交回编排层。
 */

// 贴在评论里的截图，点开看原图：抽屉宽度不一定够看清
function renderShot(shot) {
  const { alt, url } = shot;

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer";
  // 预览位只露出截图顶部，得说一声还有下文，否则读者以为图就这么大
  link.title = "点开看完整截图";

  const image = document.createElement("img");
  image.className = "shot";
  image.src = url;
  image.alt = alt || "评论里的截图";
  image.loading = "lazy";

  link.append(image);
  return link;
}

// 只有代码里真出现的标识符才渲染成可点 chip，点了没有目标的链接不做成 chip
function writeIdentifiers(target, text, context) {
  const { hitIdentifiers, onJumpTo } = context;

  const linkable = new Set(hitIdentifiers);
  let cursor = 0;

  for (const { text: identifier } of extractIdentifiers(text)) {
    if (!linkable.has(identifier)) {
      continue;
    }

    const at = text.indexOf(identifier, cursor);
    if (at < 0) {
      continue;
    }

    target.append(document.createTextNode(text.slice(cursor, at)));

    const chip = document.createElement("span");
    chip.className = "ident";
    chip.textContent = identifier;
    chip.addEventListener("click", () => onJumpTo(identifier));
    target.append(chip);

    cursor = at + identifier.length;
  }
  target.append(document.createTextNode(text.slice(cursor)));
}

// 评论与回复共用：文本段做标识符 chip，附件段渲染成截图
function writeCommentBody(target, text, context) {
  for (const piece of splitAttachments(text, context.site)) {
    if (piece.kind === "image") {
      target.append(renderShot(piece));
    } else {
      writeIdentifiers(target, piece.text, context);
    }
  }
}

/** badge 传空则不渲染徽标——「这条评论之后代码有没有动过」由结论区判定 */
export function renderCommentCard(request) {
  const { thread, badge, ...context } = request;

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

  if (badge) {
    const flag = document.createElement("span");
    flag.className = "badge";
    flag.textContent = badge;
    top.append(flag);
  }

  const body = document.createElement("p");
  writeCommentBody(body, thread.body, context);

  card.append(top, body);
  return card;
}

/** 没人回复时返回 null，让编排层整块不渲染、不留空槽 */
export function renderReplies(request) {
  const { replies, ...context } = request;

  if (!replies?.length) {
    return null;
  }

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
    writeCommentBody(body, reply.body, context);

    item.append(top, body);
    list.append(item);
  }
  return list;
}
