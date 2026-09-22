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

export function markChunksUsed(chunkIndices, totalChunks) {
  const valid = chunkIndices.filter(
    (index) => index >= 0 && index < totalChunks,
  );
  return coverageStore.markUsed(valid, totalChunks);
}

/** 手册片段全部考过，进入下一轮 */
export function startChunkNewRound() {
  return coverageStore.startNewRound();
}

export function resetChunkCoverage() {
  return coverageStore.resetProgress();
}

/** 未考片段优先；全部考过后自动开启新一轮。 */
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
