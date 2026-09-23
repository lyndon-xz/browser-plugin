/** 交卷后按卷面内容记录覆盖进度：题库题与手册片段各记一份 */

import { markBankQuestionsUsed } from "./bank.js";
import { getChunkCoverageStats, markChunksUsed } from "./material.js";

export async function recordPaperCoverage(questions) {
  const bankIds = questions
    .filter((question) => question.source !== "ai-material")
    .map((question) => question.id);
  if (bankIds.length) {
    await markBankQuestionsUsed(bankIds);
  }

  const chunkIndices = [
    ...new Set(
      questions
        .map((question) => question.materialChunkIndex)
        .filter((index) => Number.isInteger(index)),
    ),
  ];
  if (!chunkIndices.length) {
    return;
  }
  const { total } = await getChunkCoverageStats();
  await markChunksUsed(chunkIndices, total);
}
