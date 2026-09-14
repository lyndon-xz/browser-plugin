/**
 * 题库模糊匹配：归一化题干后打分，容忍空格、全半角、标点、语序与截断差异。
 */

const SCORE_THRESHOLD = 0.55;
const MIN_CONTAIN_LEN = 6;

/** 归一化：NFKC 全角转半角 → 小写 → 去空白 → 去标点。 */
export function normalize(text) {
  if (text == null) return "";
  let s = String(text);
  if (typeof s.normalize === "function") s = s.normalize("NFKC");
  s = s.toLowerCase();
  s = s.replace(/\s+/g, "");
  s = s.replace(/[!-/:-@[-`{-~]/g, "");
  s = s.replace(
    /[\u3000-\u303F\uFF00-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65\u2018\u2019\u201C\u201D\u2026\u3001\u3002\uFE30-\uFE4F]/g,
    "",
  );
  return s;
}

function bigrams(s) {
  const set = new Set();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}

function intersectionSize(a, b) {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

export function diceSimilarity(a, b) {
  if (a.length < 2 || b.length < 2) {
    return a === b ? 1 : 0;
  }
  const ba = bigrams(a);
  const bb = bigrams(b);
  const inter = intersectionSize(ba, bb);
  return (2 * inter) / (ba.size + bb.size);
}

export function charJaccard(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = intersectionSize(sa, sb);
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** 把题干与选项拼成匹配语料，支持只选中选项文字的场景。 */
export function corpus(question) {
  const parts = [question.title];
  if (Array.isArray(question.options)) {
    for (const option of question.options) {
      if (option?.key) parts.push(option.key);
      if (option?.text) parts.push(option.text);
    }
  }
  return normalize(parts.join(" "));
}

export function score(nQuery, nTitle) {
  if (!nQuery || !nTitle) return 0;
  const shorter = nQuery.length <= nTitle.length ? nQuery : nTitle;
  const longer = shorter === nQuery ? nTitle : nQuery;
  if (shorter.length >= MIN_CONTAIN_LEN && longer.includes(shorter)) {
    return 0.95;
  }
  return Math.max(charJaccard(nQuery, nTitle), diceSimilarity(nQuery, nTitle));
}

/**
 * 在题库中模糊匹配选区文本，返回最佳命中题目或 null。
 */
export function match(questions, text) {
  const nQuery = normalize(text);
  if (!nQuery || !Array.isArray(questions)) return null;

  let best = null;
  let bestScore = 0;
  for (const q of questions) {
    if (!q || !q.title) continue;
    /* 只划题干时优先与 title 比；含选项时用整题语料 */
    const s = Math.max(
      score(nQuery, normalize(q.title)),
      score(nQuery, corpus(q)),
    );
    if (
      s > bestScore ||
      (s === bestScore &&
        best &&
        q.id != null &&
        best.id != null &&
        q.id < best.id)
    ) {
      bestScore = s;
      best = q;
    }
  }
  return bestScore >= SCORE_THRESHOLD ? best : null;
}
