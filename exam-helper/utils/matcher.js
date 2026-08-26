/**
 * 匹配引擎 Matcher（M1-S2，对应验收 V-2：模糊匹配）
 *
 * 支持：多余空格、全角/半角差异、标点差异、语序打乱、题干截断。
 * 策略：先归一化，再用「子串包含（截断） + 字符集合重叠（语序无关） +
 *       二元组 Dice 相似度」综合打分，取分数最高且过阈值的题目。
 *
 * UMD 包装（TD-2，风格对齐 data/questions.js）。
 * 性能：题库规模有限，纯字符串运算，单次匹配远低于 100ms（需求 §6）。
 */
(function (global) {
  "use strict";

  // 命中阈值与截断命中的最小字符数
  const SCORE_THRESHOLD = 0.55;
  const MIN_CONTAIN_LEN = 6;

  /** 归一化：NFKC 全角转半角 → 小写 → 去空白 → 去标点。 */
  function normalize(text) {
    if (text == null) return "";
    let s = String(text);
    // NFKC：全角字母数字/空格 → 半角
    if (typeof s.normalize === "function") s = s.normalize("NFKC");
    s = s.toLowerCase();
    // 去除所有空白
    s = s.replace(/\s+/g, "");
    // 剔除标点：ASCII 标点 + 常见 CJK 标点/符号
    s = s.replace(/[!-/:-@[-`{-~]/g, "");
    s = s.replace(
      /[\u3000-\u303F\uFF00-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65\u2018\u2019\u201C\u201D\u2026\u3001\u3002\uFE30-\uFE4F]/g,
      "",
    );
    return s;
  }

  /** 生成字符二元组集合。 */
  function bigrams(s) {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  }

  /** 集合交集大小。 */
  function intersectionSize(a, b) {
    let n = 0;
    for (const x of a) if (b.has(x)) n++;
    return n;
  }

  /** Dice 相似度（基于二元组）。 */
  function diceSimilarity(a, b) {
    if (a.length < 2 || b.length < 2) {
      return a === b ? 1 : 0;
    }
    const ba = bigrams(a);
    const bb = bigrams(b);
    const inter = intersectionSize(ba, bb);
    return (2 * inter) / (ba.size + bb.size);
  }

  /** 字符一元集合的 Jaccard 相似度（语序无关）。 */
  function charJaccard(a, b) {
    const sa = new Set(a);
    const sb = new Set(b);
    const inter = intersectionSize(sa, sb);
    const union = sa.size + sb.size - inter;
    return union === 0 ? 0 : inter / union;
  }

  /** 计算查询与题干归一化文本的综合相似度分数。 */
  function score(nQuery, nTitle) {
    if (!nQuery || !nTitle) return 0;
    // 截断包含：一方是另一方的子串，且达到最小长度 → 视为强命中
    const shorter = nQuery.length <= nTitle.length ? nQuery : nTitle;
    const longer = shorter === nQuery ? nTitle : nQuery;
    if (shorter.length >= MIN_CONTAIN_LEN && longer.includes(shorter)) {
      return 0.95;
    }
    // 语序无关的字符集合重叠 + 二元组 Dice，取较大者
    return Math.max(charJaccard(nQuery, nTitle), diceSimilarity(nQuery, nTitle));
  }

  /**
   * 在题库中模糊匹配选区文本，返回最佳命中题目或 null。
   * @param {Array} questions 题库数组
   * @param {string} text 选区文本
   * @returns {object|null}
   */
  function match(questions, text) {
    const nQuery = normalize(text);
    if (!nQuery || !Array.isArray(questions)) return null;

    let best = null;
    let bestScore = 0;
    for (const q of questions) {
      if (!q || !q.title) continue;
      const s = score(nQuery, normalize(q.title));
      if (s > bestScore) {
        bestScore = s;
        best = q;
      }
    }
    return bestScore >= SCORE_THRESHOLD ? best : null;
  }

  const Matcher = { normalize, match, score, diceSimilarity, charJaccard };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { Matcher };
  } else {
    global.Matcher = Matcher;
  }
})(typeof self !== "undefined" ? self : this);
