import { EXAM_BANK } from "../../data/exam-bank.js";
import { alertDialog, closeDialog, confirmDialog } from "../ui/dialog.js";
import { showPanel, ui } from "../ui/dom.js";
import {
  resetGeneratingStatus,
  showGenerating,
  updateGeneratingProgress,
  updateGeneratingStatus,
} from "../ui/generating.js";
import {
  refreshStartPanel,
  renderReview,
  showResultSummary,
} from "../ui/render-panels.js";
import { renderQuestion, updateMixTag } from "../ui/render-question.js";
import { buildAiPaper } from "./ai-paper.js";
import { EXAM_MODES, PAPER_SOURCE } from "./constants.js";
import { buildBankPaper } from "./coverage/bank.js";
import {
  buildPaperFromIds,
  durationForCount,
  formatDuration,
  gradePaper,
  passCorrectForCount,
  shuffle,
} from "./engine.js";
import {
  answersFromRecord,
  clearSession,
  exam,
  persistSession,
  resetAnswers,
} from "./state.js";
import { PracticeStorage } from "./storage.js";

const EXAM_QUESTIONS = EXAM_BANK.questions;

function stopTimer() {
  if (exam.timerId != null) {
    clearInterval(exam.timerId);
    exam.timerId = null;
  }
}

function syncTimer() {
  const left = exam.deadlineMs - Date.now();
  ui.timerEl.textContent = formatDuration(left);
  ui.timerEl.classList.toggle("is-low", left <= 5 * 60 * 1000);
  if (left <= 0) {
    stopTimer();
    void submitExam(true);
  }
}

function startTimer(durationMs) {
  stopTimer();
  exam.deadlineMs = Date.now() + durationMs;
  syncTimer();
  exam.timerId = setInterval(syncTimer, 1000);
}

function syncPaperMetaFromPaper() {
  const questions = exam.paper.map(({ question }) => question);
  exam.paperMeta = {
    ai: questions.filter((q) => q.source === "ai-material").length,
    preset: questions.filter((q) => q.source !== "ai-material").length,
  };
}

function syncPaperQuestionsForAssist() {
  window.__ehPaperQuestions = exam.paper.map(({ question }) => question);
  window.dispatchEvent(new CustomEvent("eh-paper-updated"));
}

function clearPaperQuestionsForAssist() {
  delete window.__ehPaperQuestions;
  window.dispatchEvent(new CustomEvent("eh-paper-updated"));
}

function enterExam(remainingMs) {
  exam.lastResult = null;
  ui.reviewWrap.hidden = true;
  showPanel(ui.examPanel);
  syncPaperQuestionsForAssist();
  updateMixTag();
  startTimer(remainingMs);
  renderQuestion();
  void persistSession();
}

function resumeTimer(deadline) {
  enterExam(Math.max(0, deadline - Date.now()));
}

function questionBankForSession(session) {
  if (Array.isArray(session?.questions) && session.questions.length) {
    return session.questions;
  }
  return EXAM_QUESTIONS;
}

async function updateWrongBook(items) {
  const existing = await PracticeStorage.getWrongQuestions();
  const byId = new Map(existing.map((q) => [q.id, q]));

  for (const item of items) {
    if (item.isCorrect) {
      byId.delete(item.question.id);
    } else {
      byId.set(item.question.id, item.question);
    }
  }

  await PracticeStorage.saveWrongQuestions([...byId.values()]);
}

async function warnAiPaperQuality(meta, questionCount) {
  if (!meta || exam.paperSource !== PAPER_SOURCE.ai) {
    return;
  }
  if (meta.ai === 0) {
    await alertDialog({
      title: "AI 出题未生效",
      message: `本卷 ${questionCount} 题均由预置题库补齐。请检查 popup 中的 API 密钥与网络。`,
    });
    return;
  }
  if (meta.preset > 0) {
    await alertDialog({
      title: "AI 组卷部分失败",
      message: `本卷 AI ${meta.ai} 题，预置题库补齐 ${meta.preset} 题。`,
    });
  }
}

async function preparePaper(mode, paperSource) {
  if (paperSource === PAPER_SOURCE.preset) {
    exam.paperMeta = { ai: 0, preset: mode.questionCount };
    return buildBankPaper(mode.questionCount);
  }

  showGenerating(true);
  updateGeneratingProgress(0, mode.questionCount);
  try {
    const { paper, meta } = await buildAiPaper({
      count: mode.questionCount,
      onProgress: updateGeneratingProgress,
      onStatus: updateGeneratingStatus,
    });
    exam.paperMeta = meta;
    return paper;
  } finally {
    resetGeneratingStatus();
    showGenerating(false);
  }
}

/**
 * 组卷失败后的补救：AI 组卷可退回题库，题库组卷本身失败则只能重试。
 * 返回是否已经拿到可用的卷子。
 */
async function recoverFromPaperFailure(error, mode) {
  const message = error?.message ?? "组卷失败";
  if (exam.paperSource === PAPER_SOURCE.preset) {
    await alertDialog({ title: "题库组卷失败", message });
    return false;
  }

  const shouldUseFallback = await confirmDialog({
    title: "AI 组卷失败",
    message: `${message}\n是否改用预置题库（${EXAM_QUESTIONS.length} 题）组卷？`,
    confirmText: "用题库组卷",
  });
  if (!shouldUseFallback) {
    return false;
  }

  try {
    exam.paper = await buildBankPaper(mode.questionCount);
  } catch (fallbackError) {
    await alertDialog({
      title: "题库组卷失败",
      message: fallbackError?.message ?? "组卷失败",
    });
    return false;
  }
  exam.paperMeta = { ai: 0, preset: mode.questionCount };
  exam.paperSource = PAPER_SOURCE.preset;
  return true;
}

/**
 * 作废上一卷。exam 是模块单例、不随面板切换重置，
 * 组卷失败或被新一轮组卷取代时，旧卷会与新的 paperSource 互不匹配地留在里面。
 */
function discardCurrentPaper() {
  exam.paper = [];
  exam.paperMeta = null;
  exam.lastResult = null;
  resetAnswers();
  clearPaperQuestionsForAssist();
}

// 组卷与交卷都有 await，期间入口仍可点；两条流程并发会各自写一批覆盖进度与错题
let isFlowRunning = false;

export async function startMode(modeId) {
  const mode = EXAM_MODES[modeId];
  if (!mode || isFlowRunning) {
    return;
  }
  isFlowRunning = true;
  try {
    await enterMode(mode, modeId);
  } finally {
    isFlowRunning = false;
  }
}

async function enterMode(mode, modeId) {
  exam.currentMode = mode;
  discardCurrentPaper();

  if (modeId === "wrong") {
    const wrongQuestions = shuffle(await PracticeStorage.getWrongQuestions());
    if (!wrongQuestions.length) {
      await alertDialog({
        title: "错题本还是空的",
        message: "先完成一套模拟考或快刷，交卷后会自动收录错题。",
      });
      return;
    }
    exam.paper = buildPaperFromIds(
      wrongQuestions,
      wrongQuestions.map((q) => q.id),
    );
    syncPaperMetaFromPaper();
    exam.passThreshold = passCorrectForCount(exam.paper.length);
    exam.currentIndex = 0;
    resetAnswers();
    enterExam(durationForCount(exam.paper.length));
    return;
  }

  exam.paperSource = await PracticeStorage.getPaperSource();

  try {
    exam.paper = await preparePaper(mode, exam.paperSource);
    await warnAiPaperQuality(exam.paperMeta, mode.questionCount);
  } catch (error) {
    const isRecovered = await recoverFromPaperFailure(error, mode);
    if (!isRecovered) {
      return;
    }
  }

  exam.passThreshold = mode.passCorrect;
  exam.currentIndex = 0;
  resetAnswers();
  enterExam(mode.durationMs);
}

export async function resumeSession() {
  if (!exam.pendingSession) {
    return;
  }
  const mode = EXAM_MODES[exam.pendingSession.mode] || EXAM_MODES.l2;
  exam.currentMode = mode;
  exam.paperSource = exam.pendingSession.paperSource ?? PAPER_SOURCE.ai;
  const bank = questionBankForSession(exam.pendingSession);
  exam.paper = buildPaperFromIds(
    bank,
    exam.pendingSession.questionIds,
    exam.pendingSession.optionOrders || {},
  );
  if (!exam.paper.length) {
    await clearSession(ui.resumeCard);
    return;
  }

  syncPaperMetaFromPaper();
  exam.answers = answersFromRecord(exam.pendingSession.answers);
  exam.currentIndex = Math.min(
    Math.max(0, exam.pendingSession.currentIndex || 0),
    exam.paper.length - 1,
  );
  exam.passThreshold =
    mode.id === "wrong"
      ? passCorrectForCount(exam.paper.length)
      : mode.passCorrect;

  const deadline =
    exam.pendingSession.deadlineMs || Date.now() + (mode.durationMs || 0);
  const left = deadline - Date.now();
  if (left <= 0) {
    exam.deadlineMs = deadline;
    await submitExam(true);
    return;
  }

  exam.deadlineMs = deadline;
  updateMixTag();
  resumeTimer(deadline);
  void persistSession();
}

// 自动交卷与手动交卷可能并发落到同一份卷子上，重复结算会二次写错题本
let isSubmitting = false;

export async function submitExam(isAuto) {
  if (!exam.paper.length || isSubmitting) {
    return;
  }
  if (isAuto) {
    // 倒计时可能在手动交卷的确认框开着时归零，遮罩没有别的出口可关
    closeDialog();
  } else {
    const unanswered = exam.paper.filter(
      ({ question }) => !exam.answers.get(question.id)?.length,
    ).length;
    const isConfirmed = await confirmDialog({
      title: "确定交卷吗？",
      message:
        unanswered > 0
          ? `还有 ${unanswered} 题未作答，交卷后不能再修改。`
          : "交卷后不能再修改答案。",
      confirmText: "交卷",
    });
    // 等待确认期间可能已被自动交卷结算掉
    if (!isConfirmed || isSubmitting || !exam.paper.length) {
      return;
    }
  }

  isSubmitting = true;
  try {
    await gradeAndShowResult();
  } finally {
    isSubmitting = false;
  }
}

async function gradeAndShowResult() {
  stopTimer();
  exam.lastResult = gradePaper(exam.paper, exam.answers, exam.passThreshold);
  await updateWrongBook(exam.lastResult.items);
  clearPaperQuestionsForAssist();
  await clearSession(ui.resumeCard);
  await refreshStartPanel();

  showResultSummary();
  showPanel(ui.resultPanel);
  renderReview("wrong");
}

export async function discardSession() {
  clearPaperQuestionsForAssist();
  await clearSession(ui.resumeCard);
  await refreshStartPanel();
}

export async function clearWrongBook() {
  await PracticeStorage.saveWrongQuestions([]);
  await refreshStartPanel();
}
