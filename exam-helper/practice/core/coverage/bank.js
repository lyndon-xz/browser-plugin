/** 题库组卷的已考题目覆盖进度，与 AI 组卷的手册片段覆盖各记一份 */

import { EXAM_BANK } from "../../../data/exam-bank.js";
import { buildPaperPreferringUnused } from "../engine.js";
import { createCoverageStore } from "./store.js";

const EXAM_QUESTIONS = EXAM_BANK.questions;

const coverageStore = createCoverageStore("presetQuestionCoverage");

export function resetBankCoverage() {
  return coverageStore.resetProgress();
}

export async function getBankCoverageStats() {
  const coverage = await coverageStore.load();
  const bankIds = new Set(EXAM_QUESTIONS.map((question) => question.id));
  // 题库增删过后，存量记录里可能残留已不存在的题目
  const used = coverage.used.filter((id) => bankIds.has(id));
  return {
    used,
    usedCount: used.length,
    total: EXAM_QUESTIONS.length,
    rounds: coverage.rounds,
  };
}

/**
 * 题库组卷：避开本轮已考过的题。
 * 只读覆盖进度，不写——发卷不算考过，记录发生在交卷时。
 */
export async function buildBankPaper(count) {
  const { used, total, usedCount } = await getBankCoverageStats();
  // 整套题库都考过了，本卷从全量抽，新一轮等交卷时才落盘
  const isRoundCovered = total > 0 && usedCount >= total;
  const usedIds = new Set(isRoundCovered ? [] : used);
  return buildPaperPreferringUnused(EXAM_QUESTIONS, count, usedIds);
}

/**
 * 交卷后记下本卷考到的题库题。
 * 上一轮已考满时，本卷属于新一轮，先推进轮次再记录。
 */
export async function markBankQuestionsUsed(questionIds) {
  const { usedCount, total } = await getBankCoverageStats();
  if (total > 0 && usedCount >= total) {
    await coverageStore.startNewRound();
  }
  return coverageStore.markUsed(
    questionIds.filter((id) => Number.isInteger(id)),
    total,
  );
}
