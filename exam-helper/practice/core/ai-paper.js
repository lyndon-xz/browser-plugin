import { EXAM_BANK } from "../../data/exam-bank.js";
import { MESSAGE_ACTION, ask } from "../../shared/utils/messages.js";
import {
  extractRuleChunks,
  loadMaterialText,
} from "../../shared/utils/material-chunks.js";
import { normalize } from "../../shared/utils/matcher.js";
import { loadChunkCoverage, orderChunkIndices } from "./coverage/material.js";
import { buildPaper, shuffle } from "./engine.js";

const EXAM_QUESTIONS = EXAM_BANK.questions;
const QUESTIONS_PER_CALL = 2;
const MAX_CONCURRENT = 2;

function dedupeQuestions(list) {
  const seen = new Set();
  const out = [];
  for (const question of list) {
    const key = normalize(question.title);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(question);
  }
  return out;
}

async function generateFromChunk(excerpt, chunkIndex, reuse) {
  const items = await ask(MESSAGE_ACTION.generateQuestions, {
    excerpt,
    count: QUESTIONS_PER_CALL,
    idPrefix: `ai-${chunkIndex}-${Date.now().toString(36)}`,
    reuse,
  });
  return items.map((question) => ({
    ...question,
    materialChunkIndex: chunkIndex,
  }));
}

function fillFromPreset(pool, count) {
  const titles = new Set(pool.map((q) => normalize(q.title)));
  for (const question of shuffle(EXAM_QUESTIONS)) {
    const key = normalize(question.title);
    if (titles.has(key)) {
      continue;
    }
    pool.push({ ...question, source: "preset" });
    titles.add(key);
    if (pool.length >= count) {
      break;
    }
  }
  return pool;
}

/** 从手册 TXT 抽规约片段 → AI 出题 → 组卷；优先未考片段，片段用尽后不足才用预置题库补齐。 */
export async function buildAiPaper({ count, onProgress, onStatus }) {
  onProgress?.(0, count);

  const text = await loadMaterialText(EXAM_BANK.material.txtPath);
  const chunks = extractRuleChunks(text);
  if (!chunks.length) {
    throw new Error("手册中未找到可出题的规约片段");
  }

  const coverageBefore = await loadChunkCoverage();
  const { order, startsNewRound } = orderChunkIndices(
    chunks.length,
    coverageBefore.used,
  );
  if (startsNewRound) {
    onStatus?.("本轮已覆盖全部规约，开始新一轮");
  }

  const usedBeforeSet = new Set(startsNewRound ? [] : coverageBefore.used);
  const generated = [];
  const chunksThisPaper = new Set();
  let nextSlot = 0;

  const report = () => {
    onProgress?.(Math.min(generated.length, count), count);
  };

  async function worker() {
    while (generated.length < count) {
      const slot = nextSlot;
      nextSlot += 1;
      if (slot >= order.length) {
        break;
      }
      const chunkIndex = order[slot];
      try {
        const reuse = usedBeforeSet.has(chunkIndex);
        const items = await generateFromChunk(
          chunks[chunkIndex],
          chunkIndex,
          reuse,
        );
        generated.push(...items);
        chunksThisPaper.add(chunkIndex);
        report();
      } catch (error) {
        console.warn("[eh] ai-paper chunk failed:", error);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT, order.length) }, () =>
      worker(),
    ),
  );

  let pool = dedupeQuestions(generated);

  if (pool.length < count) {
    pool = fillFromPreset(pool, count);
  }

  if (!pool.length) {
    throw new Error("AI 出题失败，请检查 DeepSeek 密钥与网络");
  }

  report();
  const final = pool.slice(0, count);
  const meta = {
    ai: final.filter((q) => q.source === "ai-material").length,
    preset: final.filter((q) => q.source !== "ai-material").length,
    chunksThisPaper: chunksThisPaper.size,
    // 累计值是交卷前的，本卷要等交卷才计入
    coverageUsed: startsNewRound ? 0 : coverageBefore.used.length,
    coverageTotal: chunks.length,
    startsNewRound,
  };

  return {
    paper: buildPaper(final, count),
    meta,
  };
}
