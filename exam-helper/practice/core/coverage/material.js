import { EXAM_BANK } from "../../../data/exam-bank.js";
import {
  extractRuleChunks,
  loadMaterialText,
} from "../../../shared/utils/material-chunks.js";
import { shuffle } from "../engine.js";
import { createCoverageStore } from "./store.js";

const coverageStore = createCoverageStore("aiMaterialChunkCoverage");

export function loadChunkCoverage() {
  return coverageStore.load();
}

/**
 * 交卷后记下本卷考到的手册片段。
 * 上一轮已考满时，本卷属于新一轮，先推进轮次再记录。
 */
export async function markChunksUsed(chunkIndices, totalChunks) {
  const { used } = await coverageStore.load();
  if (totalChunks > 0 && used.length >= totalChunks) {
    await coverageStore.startNewRound();
  }
  return coverageStore.markUsed(
    chunkIndices.filter((index) => index >= 0 && index < totalChunks),
    totalChunks,
  );
}

export function resetChunkCoverage() {
  return coverageStore.resetProgress();
}

/** 未考片段优先；片段全部考过时一并告知该开新一轮 */
export function orderChunkIndices(totalChunks, usedIndices) {
  const usedSet = new Set(usedIndices);
  const unused = [];
  const used = [];
  for (let i = 0; i < totalChunks; i++) {
    if (usedSet.has(i)) {
      used.push(i);
    } else {
      unused.push(i);
    }
  }

  if (!unused.length) {
    const order = shuffle([...Array(totalChunks).keys()]);
    return { order, startsNewRound: totalChunks > 0 };
  }

  return {
    order: [...shuffle(unused), ...shuffle(used)],
    startsNewRound: false,
  };
}

export async function getChunkCoverageStats() {
  const coverage = await coverageStore.load();
  let total = coverage.total;
  if (!total) {
    const text = await loadMaterialText(EXAM_BANK.material.txtPath);
    total = extractRuleChunks(text).length;
  }
  return {
    ...coverage,
    total,
    usedCount: coverage.used.length,
  };
}
