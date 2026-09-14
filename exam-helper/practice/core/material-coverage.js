import { EXAM_BANK } from "../../data/exam-bank.js";
import {
  extractRuleChunks,
  loadMaterialText,
} from "../../shared/utils/material-chunks.js";
import { shuffle } from "./engine.js";

const COVERAGE_KEY = "aiMaterialChunkCoverage";

function store() {
  return chrome.storage.local;
}

export async function loadChunkCoverage() {
  const result = await store().get(COVERAGE_KEY);
  const raw = result?.[COVERAGE_KEY];
  const used = Array.isArray(raw?.used)
    ? [...new Set(raw.used.filter((n) => Number.isInteger(n) && n >= 0))]
    : [];
  return {
    used,
    total: Number.isInteger(raw?.total) && raw.total > 0 ? raw.total : 0,
    rounds: Number.isInteger(raw?.rounds) && raw.rounds > 0 ? raw.rounds : 1,
  };
}

export async function markChunksUsed(chunkIndices, totalChunks) {
  if (!chunkIndices.length || totalChunks <= 0) {
    return loadChunkCoverage();
  }
  const current = await loadChunkCoverage();
  const usedSet = new Set(current.used);
  for (const index of chunkIndices) {
    if (index >= 0 && index < totalChunks) {
      usedSet.add(index);
    }
  }
  const next = {
    used: [...usedSet].sort((a, b) => a - b),
    total: totalChunks,
    rounds: current.rounds,
  };
  await store().set({ [COVERAGE_KEY]: next });
  return next;
}

export async function resetChunkCoverage() {
  const current = await loadChunkCoverage();
  const next = {
    used: [],
    total: current.total,
    rounds: current.rounds + 1,
  };
  await store().set({ [COVERAGE_KEY]: next });
  return next;
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
    return { order, roundReset: totalChunks > 0 };
  }

  return { order: [...shuffle(unused), ...shuffle(used)], roundReset: false };
}

export function formatCoverageLabel(coverage) {
  const total = coverage.total;
  if (!total) {
    return "";
  }
  const used = coverage.used.length;
  const pct = Math.round((used / total) * 100);
  return `手册已覆盖 ${used}/${total} 条（${pct}%）`;
}

export async function getChunkCoverageStats() {
  const coverage = await loadChunkCoverage();
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
