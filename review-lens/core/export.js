// 把学习卡片导出成可以直接贴进笔记的 Markdown。卡片里不含令牌，所以这里不做过滤

// 代码里若含三反引号，围栏必须比它更长，否则代码块会被提前截断
function fence(code) {
  const longest = Math.max(
    0,
    ...[...String(code).matchAll(/`{3,}/g)].map((match) => match[0].length),
  );
  return "`".repeat(Math.max(3, longest + 1));
}

const codeBlock = (code) => {
  const rail = fence(code);
  return `${rail}java\n${code}\n${rail}`;
};

const asDate = (iso) => String(iso ?? "").slice(0, 10);

function section(card) {
  const { source, comment } = card;
  const lines = [
    `## ${card.symbol}`,
    "",
    // 有的卡片没有 webUrl，写成链接就是 `](undefined)`；弹窗侧同样按缺失处理
    source.webUrl
      ? `- 位置：[${source.path.split("/").at(-1)}:${source.line}](${source.webUrl})`
      : `- 位置：${source.path.split("/").at(-1)}:${source.line}`,
    // projectPath 是人读的路径；project 是 encodeURIComponent 后的 API id，不该出现在笔记里
    `- 项目：\`${source.projectPath ?? decodeURIComponent(source.project ?? "")}\` · MR !${source.mrIid}`,
    `- 存于：${asDate(card.savedAt)}`,
    "",
    `### 评论 · ${comment.author} · ${asDate(comment.createdAt)}`,
    "",
    comment.body,
    "",
  ];

  for (const reply of card.replies ?? []) {
    lines.push(
      `> **${reply.author}** · ${asDate(reply.createdAt)}：${reply.body}`,
      "",
    );
  }

  lines.push("### 评论时", "", codeBlock(card.thenCode), "");

  lines.push(
    "### 修正后",
    "",
    card.nowCode === null
      ? "这处至今未改动，评论提的问题仍然成立。"
      : codeBlock(card.nowCode),
    "",
  );

  if (card.note) {
    lines.push("### 我的笔记", "", card.note, "");
  }

  return lines.join("\n");
}

export function toMarkdown(cards) {
  const head = [
    "# review-lens 学习卡片",
    "",
    `导出于 ${asDate(new Date().toISOString())}`,
    "",
  ];

  if (!cards.length) {
    return [
      ...head,
      "还没有卡片。在 GitLab 的代码评论旁点「解读」，看懂一条就存下来。",
      "",
    ].join("\n");
  }

  const newestFirst = [...cards].sort((a, b) =>
    String(b.savedAt).localeCompare(String(a.savedAt)),
  );
  return [...head, ...newestFirst.map(section)].join("\n");
}
