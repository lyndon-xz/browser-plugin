import { splitAttachments } from "../../core/comment/attachment.js";
import { extractIdentifiers } from "../../core/comment/identifier.js";
import { asDate } from "../../core/date.js";

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
  image.alt = alt ?? "评论里的截图";
  image.loading = "lazy";

  link.append(image);
  return link;
}

function renderAuthorRow(request) {
  const { author, createdAt, className, badge } = request;

  const top = document.createElement("div");
  top.className = className;

  const name = document.createElement("span");
  name.className = "name";
  name.textContent = author;

  const when = document.createElement("span");
  when.className = "when";
  when.textContent = asDate(createdAt);

  top.append(name, when);

  if (badge) {
    const flag = document.createElement("span");
    flag.className = "badge";
    flag.textContent = badge;
    top.append(flag);
  }

  return top;
}

// 只有代码里真出现的标识符才渲染成可点 chip，点了没有目标的链接不做成 chip
function writeIdentifiers(target, text, request) {
  const { hitIdentifiers, onJumpTo } = request;

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
function writeCommentBody(target, text, request) {
  const { site, hitIdentifiers, onJumpTo } = request;

  for (const piece of splitAttachments(text, site)) {
    if (piece.kind === "image") {
      target.append(renderShot(piece));
    } else {
      writeIdentifiers(target, piece.text, { hitIdentifiers, onJumpTo });
    }
  }
}

/** badge 传空则不渲染徽标——「这条评论之后代码有没有动过」由结论区判定 */
export function renderCommentCard(request) {
  const { thread, badge, site, hitIdentifiers, onJumpTo } = request;
  const { author, createdAt, body } = thread;

  const card = document.createElement("section");
  card.className = "comment-card";

  const bodyEl = document.createElement("p");
  writeCommentBody(bodyEl, body, { site, hitIdentifiers, onJumpTo });

  card.append(
    renderAuthorRow({
      author,
      createdAt,
      className: "comment-card-top",
      badge,
    }),
    bodyEl,
  );
  return card;
}

/** 没人回复时返回 null，让编排层整块不渲染、不留空槽 */
export function renderReplies(request) {
  const { replies, site, hitIdentifiers, onJumpTo } = request;

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

    const body = document.createElement("p");
    writeCommentBody(body, reply.body, { site, hitIdentifiers, onJumpTo });

    item.append(
      renderAuthorRow({
        author: reply.author,
        createdAt: reply.createdAt,
        className: "reply-top",
      }),
      body,
    );
    list.append(item);
  }
  return list;
}
