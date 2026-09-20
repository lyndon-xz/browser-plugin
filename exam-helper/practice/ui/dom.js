/** 练习页 DOM 引用与通用 UI 工具 */

export const ui = {
  startPanel: document.getElementById("start-panel"),
  examPanel: document.getElementById("exam-panel"),
  resultPanel: document.getElementById("result-panel"),
  resumeCard: document.getElementById("resume-card"),
  resumeDesc: document.getElementById("resume-desc"),
  wrongCountEl: document.getElementById("wrong-count"),
  timerEl: document.getElementById("timer"),
  progressText: document.getElementById("progress-text"),
  answeredText: document.getElementById("answered-text"),
  progressFill: document.getElementById("progress-fill"),
  mixTag: document.getElementById("mix-tag"),
  bankStatsEl: document.getElementById("bank-stats"),
  materialStatsEl: document.getElementById("material-stats"),
  coverageStatsEl: document.getElementById("coverage-stats"),
  sourceFootnoteEl: document.getElementById("source-footnote"),
  typeTag: document.getElementById("type-tag"),
  qTitle: document.getElementById("q-title"),
  optionsEl: document.getElementById("options"),
  jumpGrid: document.getElementById("jump-grid"),
  reviewWrap: document.getElementById("review-wrap"),
  reviewList: document.getElementById("review-list"),
  reviewTitleEl: document.getElementById("review-title"),
  reviewMetaEl: document.getElementById("review-meta"),
  reviewBtn: document.getElementById("review-btn"),
  fullReviewBtn: document.getElementById("full-review-btn"),
  resultLabel: document.getElementById("result-label"),
  resultScore: document.getElementById("result-score"),
  resultPercent: document.getElementById("result-percent"),
  resultHint: document.getElementById("result-hint"),
  prevBtn: document.getElementById("prev-btn"),
  nextBtn: document.getElementById("next-btn"),
};

export { escapeHtml } from "../../shared/utils/html.js";

export function showPanel(panel) {
  ui.startPanel.hidden = panel !== ui.startPanel;
  ui.examPanel.hidden = panel !== ui.examPanel;
  ui.resultPanel.hidden = panel !== ui.resultPanel;
  ui.timerEl.hidden = panel !== ui.examPanel;
}
