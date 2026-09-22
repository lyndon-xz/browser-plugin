// 练习页入口：绑定事件并展示起始面板
import "../../content/assist/page-assist.js";
import { DEFAULT_SCENARIO_ID, getScenario } from "../../data/scenarios.js";
import { EXAM_MODES, PAPER_SOURCE } from "../core/constants.js";
import { resetBankCoverage } from "../core/coverage/bank.js";
import { resetChunkCoverage } from "../core/coverage/material.js";
import {
  clearWrongBook,
  discardSession,
  resumeSession,
  startMode,
  submitExam,
} from "../core/exam-flow.js";
import { exam, scheduleSaveSession } from "../core/state.js";
import { handleExamKeydown } from "../input/keyboard.js";
import { alertDialog, confirmDialog } from "../ui/dialog.js";
import { showPanel, ui } from "../ui/dom.js";
import {
  bindPaperSourceToggle,
  syncPaperSourceUi,
} from "../ui/paper-source.js";
import {
  refreshCoverageStats,
  refreshStartPanel,
  renderReview,
} from "../ui/render-panels.js";
import { renderQuestion } from "../ui/render-question.js";

/**
 * 包出一个事件监听器：回调里的失败没有别的接管者，
 * 不接住就是静默的 unhandled rejection，界面停在旧数据上。
 */
function withFailureAlert(action) {
  return async () => {
    try {
      await action();
    } catch (error) {
      console.error("[exam-helper] 操作失败：", error);
      await alertDialog({
        title: "操作失败",
        message: error?.message ?? "请重试，或重新打开练习页。",
      });
    }
  };
}

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

document.getElementById("discard-btn").addEventListener(
  "click",
  withFailureAlert(async () => {
    const isConfirmed = await confirmDialog({
      title: "放弃这份卷子？",
      message: "已作答的内容会被清空，且无法恢复。",
      confirmText: "放弃",
    });
    if (isConfirmed) {
      await discardSession();
    }
  }),
);

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

document.getElementById("clear-wrong-btn").addEventListener(
  "click",
  withFailureAlert(async () => {
    const isConfirmed = await confirmDialog({
      title: "清空错题本？",
      message: "全部历史错题会被移除，且无法恢复。",
      confirmText: "清空",
    });
    if (isConfirmed) {
      await clearWrongBook();
    }
  }),
);

document.addEventListener("keydown", handleExamKeydown, true);

bindPaperSourceToggle();

// 覆盖行是刷新时重建的，重置按钮只能靠委托绑定
document.body.addEventListener("click", (event) => {
  const { target } = event;
  if (target?.id !== "reset-coverage-btn") {
    return;
  }
  const isBank = target.dataset.source === PAPER_SOURCE.preset;
  void withFailureAlert(async () => {
    const isConfirmed = await confirmDialog({
      title: isBank ? "重置题库覆盖记录？" : "重置手册覆盖记录？",
      message: isBank
        ? "下次题库组卷将重新从没考过的题目开始。"
        : "下次 AI 组卷将重新从未考片段开始。",
      confirmText: "重置",
    });
    if (!isConfirmed) {
      return;
    }
    await (isBank ? resetBankCoverage() : resetChunkCoverage());
    await refreshCoverageStats();
  })();
});

void refreshStartPanel().then(() => {
  void syncPaperSourceUi();
  showPanel(ui.startPanel);
});
