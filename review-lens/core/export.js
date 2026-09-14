import { UNLOCATABLE_EXPORT } from "./compare-copy.js";
import { COMPARE_STATE } from "./compare.js";
import { asDate } from "./date.js";

// 把学习卡片导出成可以直接贴进笔记的 Markdown。卡片里不含令牌，所以这里不做过滤

// 代码里若含三反引号，围栏必须比它更长，否则代码块会被提前截断
function fence(code) {
  const longest = Math.max(
    0,
    ...[...String(code).matchAll(/`{3,}/g)].map((match) => match[0].length),
  );
  return "`".repeat(Math.max(3, longest + 1));
}

const EXT_TO_LANG = {
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  py: "python",
  js: "javascript",
  ts: "typescript",
  jsx: "jsx",
  tsx: "tsx",
  go: "go",
  rs: "rust",
  rb: "ruby",
  cs: "csharp",
  cpp: "cpp",
  c: "c",
  h: "c",
  swift: "swift",
  sql: "sql",
  sh: "bash",
  yaml: "yaml",
  yml: "yaml",
};

function languageFromPath(path) {
  const ext = path?.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_LANG[ext] ?? ext;
}

const codeBlock = (code, path) => {
  const rail = fence(code);
  const lang = languageFromPath(path);
  return lang ? `${rail}${lang}\n${code}\n${rail}` : `${rail}\n${code}\n${rail}`;
};

function nowSection(card) {
  const { nowCode, compareState } = card;

  if (compareState === COMPARE_STATE.unlocatable) {
    return UNLOCATABLE_EXPORT;
  }
  if (nowCode === null || compareState === COMPARE_STATE.unchanged) {
    return "这处至今未改动，评论提的问题仍然成立。";
  }
  return codeBlock(nowCode, card.source.path);
}

function section(card) {
  const { source, comment, symbol, savedAt, replies, thenCode, note } = card;
  const { webUrl, path, line, projectPath, project, mrIid } = source;
  const lines = [
    `## ${symbol}`,
    "",
    // 有的卡片没有 webUrl，写成链接就是 `](undefined)`；弹窗侧同样按缺失处理
    webUrl
      ? `- 位置：[${path.split("/").at(-1)}:${line}](${webUrl})`
      : `- 位置：${path.split("/").at(-1)}:${line}`,
    // projectPath 是人读的路径；project 是 encodeURIComponent 后的 API id，不该出现在笔记里
    `- 项目：\`${projectPath ?? decodeURIComponent(project ?? "")}\` · MR !${mrIid}`,
    `- 存于：${asDate(savedAt)}`,
    "",
    `### 评论 · ${comment.author} · ${asDate(comment.createdAt)}`,
    "",
    comment.body,
    "",
  ];

  for (const reply of replies ?? []) {
    lines.push(
      `> **${reply.author}** · ${asDate(reply.createdAt)}：${reply.body}`,
      "",
    );
  }

  lines.push("### 评论时", "", codeBlock(thenCode, path), "");

  lines.push("### 修正后", "", nowSection(card), "");

  if (note) {
    lines.push("### 我的笔记", "", note, "");
  }

  return lines.join("\n");
}

/** 把学习卡片导出为可直接贴进笔记的 Markdown */
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
