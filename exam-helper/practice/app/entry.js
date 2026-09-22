// 练习页入口：绑定事件并展示起始面板
import "../../content/assist/page-assist.js";
import { DEFAULT_SCENARIO_ID, getScenario } from "../../data/scenarios.js";
import { EXAM_MODES } from "../core/constants.js";
import {
  discardSession,
  resumeSession,
  startMode,
  submitExam,
} from "../core/exam-flow.js";
import { exam, scheduleSaveSession } from "../core/state.js";
import { handleExamKeydown } from "../input/keyboard.js";
import { showPanel, ui } from "../ui/dom.js";
import {
  bindPaperSourceToggle,
  syncPaperSourceUi,
} from "../ui/paper-source.js";
import { resetChunkCoverage } from "../core/material-coverage.js";
import {
  refreshCoverageStats,
  refreshStartPanel,
  renderReview,
} from "../ui/render-panels.js";
import { renderQuestion } from "../ui/render-question.js";

function applyScenarioFromUrl() {
  const scenarioId =
    new URLSearchParams(location.search).get("scenario") || DEFAULT_SCENARIO_ID;
  const scenario = getScenario(scenarioId);
  document.title = `exam-helper · ${scenario.label}`;
  const heading = document.querySelector(".top h1");
  const sub = document.getElementById("mode-sub");
  if (heading) {
    heading.textContent = `${scenario.label} 练习`;
  }
  if (sub) {
    sub.textContent = scenario.summary;
  }
}

applyScenarioFromUrl();

exam.currentMode = EXAM_MODES.l2;
exam.passThreshold = EXAM_MODES.l2.passCorrect;

document.querySelectorAll(".mode-card").forEach((btn) => {
  btn.addEventListener("click", () => {
    void startMode(btn.dataset.mode);
  });
});

document.getElementById("resume-btn").addEventListener("click", () => {
  void resumeSession();
});

document.getElementById("discard-btn").addEventListener("click", () => {
  if (window.confirm("确定放弃未完成的卷子吗？")) {
    void discardSession();
  }
});

ui.prevBtn.addEventListener("click", () => {
  if (exam.currentIndex > 0) {
    exam.currentIndex -= 1;
    renderQuestion();
    scheduleSaveSession();
  }
});

ui.nextBtn.addEventListener("click", () => {
  if (exam.currentIndex < exam.paper.length - 1) {
    exam.currentIndex += 1;
    renderQuestion();
    scheduleSaveSession();
  }
});

document.getElementById("submit-btn").addEventListener("click", () => {
  void submitExam(false);
});

document.getElementById("retry-btn").addEventListener("click", () => {
  void refreshStartPanel().then(() => {
    void syncPaperSourceUi();
    showPanel(ui.startPanel);
  });
});

document.getElementById("review-btn").addEventListener("click", () => {
  renderReview("wrong");
});

document.getElementById("full-review-btn").addEventListener("click", () => {
  renderReview("all");
});

document.getElementById("wrong-btn").addEventListener("click", () => {
  void startMode("wrong");
});

document.addEventListener("keydown", handleExamKeydown, true);

bindPaperSourceToggle();

document.body.addEventListener("click", (event) => {
  if (event.target?.id !== "reset-coverage-btn") {
    return;
  }
  if (
    !window.confirm(
      "确定重置手册覆盖记录吗？下次 AI 组卷将重新从未考片段开始。",
    )
  ) {
    return;
  }
  void resetChunkCoverage().then(() => refreshCoverageStats());
});

void refreshStartPanel().then(() => {
  void syncPaperSourceUi();
  showPanel(ui.startPanel);
});
