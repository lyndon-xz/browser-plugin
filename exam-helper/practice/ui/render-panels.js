import { EXAM_BANK } from "../../data/exam-bank.js";
import { EXAM_MODES, PAPER_SOURCE } from "../core/constants.js";
import { formatDuration, getBankStats } from "../core/engine.js";

const EXAM_QUESTIONS = EXAM_BANK.questions;
import {
  formatCoverageLabel,
  getChunkCoverageStats,
} from "../core/material-coverage.js";
import { PracticeStorage } from "../core/storage.js";
import { exam } from "../core/state.js";
import { formatExplain } from "../../shared/utils/html.js";
import { escapeHtml, ui } from "./dom.js";

/** 首页 AI 组卷的手册覆盖进度（题库组卷时隐藏） */
export async function refreshCoverageStats(sourcePromise) {
  if (!ui.coverageStatsEl) {
    return;
  }
  const paperSource = sourcePromise
    ? await sourcePromise
    : await PracticeStorage.getPaperSource();
  if (paperSource !== PAPER_SOURCE.ai) {
    ui.coverageStatsEl.hidden = true;
    return;
  }

  const stats = await getChunkCoverageStats();
  const label = formatCoverageLabel({
    used: stats.used,
    total: stats.total,
    rounds: stats.rounds,
  });
  if (!label) {
    ui.coverageStatsEl.hidden = true;
    return;
  }

  const roundNote = stats.rounds > 1 ? ` · 第 ${stats.rounds} 轮` : "";
  ui.coverageStatsEl.hidden = false;
  ui.coverageStatsEl.innerHTML = `${escapeHtml(label + roundNote)}<button type="button" id="reset-coverage-btn">重置覆盖</button>`;
}

/** 刷新首页：题库统计、错题数、续考卡片 */
export async function refreshStartPanel() {
  exam.pendingSession = await PracticeStorage.loadSession();
  const bank = getBankStats(EXAM_QUESTIONS);

  ui.bankStatsEl.textContent = `内置题库 ${bank.total} 题 · 单选 ${bank.single} · 多选 ${bank.multi}`;

  if (ui.sourceFootnoteEl) {
    ui.sourceFootnoteEl.innerHTML =
      "<strong>AI 组卷</strong>：优先抽尚未考过的手册片段，由 DeepSeek 推理出题；卷头与首页可见覆盖进度（需 popup 配 API 密钥）。" +
      `<strong>题库组卷</strong>：从内置 ${bank.total} 题随机抽，秒开。` +
      "查答案：📚 答案匹配（已有题目）· 🤖 AI 推理（现场调用）。" +
      "卷头「组卷 · AI / 预置」指开卷来源，与查答案标签无关。";
  }

  if (ui.materialStatsEl) {
    const pdfUrl = chrome.runtime.getURL(EXAM_BANK.material.pdfPath);
    ui.materialStatsEl.innerHTML = `依据：<a href="${pdfUrl}" target="_blank" rel="noopener">${escapeHtml(EXAM_BANK.material.title)}</a> · AI 组卷优先未考片段`;
  }
  await refreshCoverageStats();
  const wrongQuestions = await PracticeStorage.getWrongQuestions();
  ui.wrongCountEl.textContent =
    wrongQuestions.length > 0
      ? `共 ${wrongQuestions.length} 道历史错题`
      : "错题本为空，先完成一套卷子";

  if (exam.pendingSession?.questionIds?.length) {
    const mode = EXAM_MODES[exam.pendingSession.mode] || EXAM_MODES.l2;
    const answered = Object.keys(exam.pendingSession.answers || {}).length;
    const total = exam.pendingSession.questionIds.length;
    const left = Math.max(0, exam.pendingSession.deadlineMs - Date.now());
    ui.resumeDesc.textContent = `${mode.label}：已答 ${answered}/${total} 题，剩余 ${formatDuration(left)}`;
    ui.resumeCard.hidden = false;
  } else {
    ui.resumeCard.hidden = true;
  }
}

/** 错题回顾列表 */
export function renderReview() {
  if (!exam.lastResult) {
    return;
  }
  const items = exam.lastResult.items.filter((item) => !item.isCorrect);

  if (!items.length) {
    ui.reviewList.innerHTML = '<p class="review-ans">全部答对，没有错题。</p>';
    ui.reviewWrap.hidden = false;
    return;
  }

  ui.reviewList.innerHTML = items
    .map(({ index, question, selected }) => {
      const correct = (question.answer || []).join(" ");
      const yours = selected.length ? selected.join(" ") : "未作答";
      const explain = question.explain
        ? `<div class="review-ans">${escapeHtml(formatExplain(question.explain))}</div>`
        : "";
      return `
        <article class="review-item">
          <div class="review-q">${index + 1}. ${escapeHtml(question.title)}</div>
          <div class="review-ans">你的答案：<span class="wrong">${escapeHtml(yours)}</span></div>
          <div class="review-ans">正确答案：<strong>${escapeHtml(correct)}</strong></div>
          ${explain}
        </article>
      `;
    })
    .join("");
  ui.reviewWrap.hidden = false;
  ui.reviewWrap.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** 结果页文案 */
export function showResultSummary() {
  const { lastResult, currentMode } = exam;
  if (!lastResult) {
    return;
  }

  ui.resultLabel.textContent = lastResult.isPassed
    ? "恭喜，本轮及格"
    : "未达及格线";
  ui.resultScore.textContent = `${lastResult.correctCount} / ${lastResult.total}`;
  ui.resultPercent.textContent = `${lastResult.scorePercent} 分`;
  ui.resultPercent.classList.toggle("is-pass", lastResult.isPassed);
  ui.resultPercent.classList.toggle("is-fail", !lastResult.isPassed);

  const gap = lastResult.passCorrect - lastResult.correctCount;
  ui.resultHint.textContent = lastResult.isPassed
    ? `${currentMode.label}：需答对 ${lastResult.passCorrect} 题及格。建议用「只练错题」巩固薄弱点。`
    : gap > 0
      ? `还差 ${gap} 题达到及格线（${lastResult.passCorrect} 题）。错题已收录，可点「去练错题本」。`
      : "继续加油，错题已收录。";
}
