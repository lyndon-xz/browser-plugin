/** 从《Java 开发手册》TXT 提取可出题的规约片段 */

const RULE_LINE = /\d+\.【强制】|\d+\.【推荐】/;
const MIN_CHUNK_LEN = 80;
const MAX_CHUNK_LEN = 1000;

export async function loadMaterialText(txtPath) {
  const url = chrome.runtime.getURL(txtPath);
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error("手册文本加载失败");
  }
  return resp.text();
}

/** 按【强制】/【推荐】条目切分规约片段，供 AI 命题。 */
export function extractRuleChunks(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const chunks = [];
  let current = "";
  let passedToc = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!passedToc) {
      if (/^一、编程规约/.test(trimmed)) {
        passedToc = true;
      } else {
        continue;
      }
    }

    if (RULE_LINE.test(trimmed)) {
      if (current.trim().length >= MIN_CHUNK_LEN) {
        chunks.push(current.trim().slice(0, MAX_CHUNK_LEN));
      }
      current = trimmed;
      continue;
    }

    if (!current) {
      continue;
    }

    current += `\n${line}`;
    if (current.length >= MAX_CHUNK_LEN) {
      chunks.push(current.trim().slice(0, MAX_CHUNK_LEN));
      current = "";
    }
  }

  if (current.trim().length >= MIN_CHUNK_LEN) {
    chunks.push(current.trim().slice(0, MAX_CHUNK_LEN));
  }

  return chunks.filter((chunk) => RULE_LINE.test(chunk));
}
