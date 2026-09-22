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
 * 题库组卷：避开本轮已考过的题，并把本卷考到的题记进覆盖进度。
 * 整套题库都考过时先开启新一轮，轮次在本卷记录成功之后才推进。
 */
export async function buildBankPaper(count) {
  const { used, total, usedCount } = await getBankCoverageStats();
  const isRoundCovered = total > 0 && usedCount >= total;
  const usedIds = new Set(isRoundCovered ? [] : used);

  const paper = buildPaperPreferringUnused(EXAM_QUESTIONS, count, usedIds);
  const paperIds = paper.map((slot) => slot.question.id);

  if (isRoundCovered) {
    await coverageStore.startNewRound();
  }
  await coverageStore.markUsed(
    paperIds.filter((id) => Number.isInteger(id)),
    EXAM_QUESTIONS.length,
  );
  return paper;
}

/** AI 组卷用题库原题补齐时，这些题同样算考过 */
export function markBankQuestionsUsed(questionIds) {
  return coverageStore.markUsed(
    questionIds.filter((id) => Number.isInteger(id)),
    EXAM_QUESTIONS.length,
  );
}
