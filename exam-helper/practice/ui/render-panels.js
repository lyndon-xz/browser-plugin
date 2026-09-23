import { EXAM_BANK } from "../../data/exam-bank.js";
import { formatExplain } from "../../shared/utils/html.js";
import { EXAM_MODES, PAPER_SOURCE } from "../core/constants.js";
import { getBankCoverageStats } from "../core/coverage/bank.js";
import {
  formatBankCoverageLabel,
  formatChunkCoverageLabel,
} from "../core/coverage/label.js";
import { getChunkCoverageStats } from "../core/coverage/material.js";
import {
  formatDuration,
  getBankStats,
  getDisplayOptions,
  orderedOptionKeys,
} from "../core/engine.js";
import { exam } from "../core/state.js";
import { PracticeStorage } from "../core/storage.js";
import { escapeHtml, ui } from "./dom.js";

const EXAM_QUESTIONS = EXAM_BANK.questions;

// 切换组卷来源会连开两条刷新链，AI 分支首次要拉整份手册 TXT、比题库分支慢得多
let coverageToken = 0;

/** 首页组卷覆盖进度：AI 组卷看手册片段，题库组卷看已考题目 */
export async function refreshCoverageStats(sourcePromise) {
  if (!ui.coverageStatsEl) {
    return;
  }
  // 先作废旧标签：它上面的 data-source 决定「重置覆盖」清哪一份记录
  ui.coverageStatsEl.hidden = true;
  ui.coverageStatsEl.innerHTML = "";
  const token = ++coverageToken;

  const paperSource = sourcePromise
    ? await sourcePromise
    : await PracticeStorage.getPaperSource();
  const isAi = paperSource === PAPER_SOURCE.ai;

  const stats = isAi
    ? await getChunkCoverageStats()
    : await getBankCoverageStats();
  const label = isAi
    ? formatChunkCoverageLabel(stats)
    : formatBankCoverageLabel(stats);
  if (token !== coverageToken || !label) {
    return;
  }

  const roundNote = stats.rounds > 1 ? ` · 第 ${stats.rounds} 轮` : "";
  ui.coverageStatsEl.hidden = false;
  ui.coverageStatsEl.innerHTML = `${escapeHtml(label + roundNote)}<button type="button" class="text-btn" id="reset-coverage-btn" data-source="${paperSource}">重置覆盖</button>`;
}

/** 刷新首页：题库统计、错题数、续考卡片 */
export async function refreshStartPanel() {
  exam.pendingSession = await PracticeStorage.loadSession();
  const bank = getBankStats(EXAM_QUESTIONS);

  ui.bankStatsEl.textContent = `内置题库 ${bank.total} 题 · 单选 ${bank.single} · 多选 ${bank.multi}`;

  if (ui.sourceFootnoteEl) {
    ui.sourceFootnoteEl.innerHTML =
      "<strong>AI 组卷</strong>：优先抽尚未考过的手册片段，由 DeepSeek 推理出题；卷头与首页可见覆盖进度（需 popup 配 API 密钥）。" +
      `<strong>题库组卷</strong>：从内置 ${bank.total} 题优先抽没考过的，秒开。` +
      "覆盖进度按交卷计，放弃的卷子不计入。" +
      "查答案：📚 答案匹配（已有题目）· 🤖 AI 推理（现场调用）。" +
      "卷头「组卷 · AI / 预置」指开卷来源，与查答案标签无关。";
  }

  if (ui.materialStatsEl) {
    const pdfUrl = chrome.runtime.getURL(EXAM_BANK.material.pdfPath);
    // 措辞对两种组卷来源都成立：这行不随来源重渲染，跟着变就会与覆盖行对不上
    ui.materialStatsEl.innerHTML = `依据：<a href="${pdfUrl}" target="_blank" rel="noopener">${escapeHtml(EXAM_BANK.material.title)}</a> · 组卷优先未考过的部分`;
  }
  await refreshCoverageStats();
  const wrongQuestions = await PracticeStorage.getWrongQuestions();
  ui.wrongCountEl.textContent =
    wrongQuestions.length > 0
      ? `共 ${wrongQuestions.length} 道历史错题`
      : "错题本为空，先完成一套卷子";
  if (ui.wrongBookRow) {
    ui.wrongBookRow.hidden = wrongQuestions.length === 0;
  }

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

let reviewScope = "wrong";

function syncReviewActionButtons() {
  ui.reviewBtn?.classList.toggle("is-active", reviewScope === "wrong");
  ui.fullReviewBtn?.classList.toggle("is-active", reviewScope === "all");
}

function renderReviewOptions(question, optionKeys, selected, isCorrect) {
  const correctSet = new Set(question.answer || []);
  const selectedSet = new Set(selected);
  const keys =
    optionKeys?.length > 0 ? optionKeys : orderedOptionKeys(question);
  const displayOptions = getDisplayOptions(question, keys);

  if (!displayOptions.length) {
    return "";
  }

  const rows = displayOptions
    .map((option) => {
      const isCorrectOption = correctSet.has(option.key);
      const isPicked = selectedSet.has(option.key);
      const classes = ["review-option"];
      if (isPicked && isCorrectOption) {
        classes.push("is-pick-correct");
      } else if (isPicked && !isCorrectOption) {
        classes.push("is-pick-wrong");
      } else if (!isPicked && isCorrectOption && !isCorrect) {
        classes.push("is-correct-missed");
      }
      return `<li class="${classes.join(" ")}"><span class="review-option-key">${escapeHtml(option.key)}.</span>${escapeHtml(option.text)}</li>`;
    })
    .join("");

  return `<ul class="review-options">${rows}</ul>`;
}

function renderReviewItem(item, { showStatus } = { showStatus: false }) {
  const { index, question, optionKeys, selected, isCorrect } = item;
  const correct = (question.answer || []).join(" ");
  const yours = selected.length ? selected.join(" ") : "未作答";
  const typeLabel = question.type === "single" ? "单选" : "多选";
  const optionsHtml = renderReviewOptions(
    question,
    optionKeys,
    selected,
    isCorrect,
  );
  const explain = question.explain
    ? `<div class="review-explain">${escapeHtml(formatExplain(question.explain))}</div>`
    : "";
  const statusHtml = showStatus
    ? `<span class="review-status ${isCorrect ? "is-pass" : "is-fail"}">${isCorrect ? "答对" : "答错"}</span>`
    : "";

  return `
    <article class="review-item ${isCorrect ? "is-correct" : "is-wrong"}">
      <div class="review-q-row">
        <div class="review-q">${index + 1}. ${escapeHtml(question.title)}</div>
        ${statusHtml}
      </div>
      <div class="review-type-tag">${typeLabel}</div>
      ${optionsHtml}
      <div class="review-answer-block">
        <div class="review-ans">你的答案：<span class="${isCorrect ? "is-yours-ok" : "wrong"}">${escapeHtml(yours)}</span></div>
        <div class="review-ans">正确答案：<strong>${escapeHtml(correct)}</strong></div>
      </div>
      ${explain}
    </article>
  `;
}

/** 交卷后回顾：wrong 仅错题，all 整卷 */
export function renderReview(scope = reviewScope) {
  if (!exam.lastResult) {
    return;
  }

  reviewScope = scope;
  syncReviewActionButtons();

  const { items, correctCount, total } = exam.lastResult;
  const visibleItems =
    reviewScope === "all" ? items : items.filter((item) => !item.isCorrect);

  if (ui.reviewTitleEl) {
    ui.reviewTitleEl.textContent =
      reviewScope === "all" ? "整卷回顾" : "错题回顾";
  }
  if (ui.reviewMetaEl) {
    ui.reviewMetaEl.textContent =
      reviewScope === "all"
        ? `共 ${total} 题 · 答对 ${correctCount} · 答错 ${total - correctCount}`
        : visibleItems.length > 0
          ? `共 ${visibleItems.length} 道错题`
          : "全部答对";
  }

  if (!visibleItems.length) {
    ui.reviewList.innerHTML =
      '<p class="review-empty">全部答对，没有错题。</p>';
    ui.reviewWrap.hidden = false;
    ui.reviewWrap.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  ui.reviewList.innerHTML = visibleItems
    .map((item) =>
      renderReviewItem(item, { showStatus: reviewScope === "all" }),
    )
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
