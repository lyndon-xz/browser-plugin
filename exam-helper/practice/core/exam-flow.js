import { EXAM_BANK } from "../../data/exam-bank.js";
import { EXAM_MODES, PAPER_SOURCE } from "./constants.js";
import { buildAiPaper } from "./ai-paper.js";

const EXAM_QUESTIONS = EXAM_BANK.questions;
import {
  buildPaper,
  buildPaperFromIds,
  durationForCount,
  formatDuration,
  gradePaper,
  passCorrectForCount,
  shuffle,
} from "./engine.js";
import { PracticeStorage } from "./storage.js";
import { showPanel, ui } from "../ui/dom.js";
import {
  refreshStartPanel,
  renderReview,
  showResultSummary,
} from "../ui/render-panels.js";
import {
  resetGeneratingStatus,
  showGenerating,
  updateGeneratingProgress,
  updateGeneratingStatus,
} from "../ui/generating.js";
import { renderQuestion, updateMixTag } from "../ui/render-question.js";
import {
  answersFromRecord,
  clearSession,
  exam,
  persistSession,
  resetAnswers,
} from "./state.js";

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

function warnAiPaperQuality(meta, questionCount) {
  if (!meta || exam.paperSource !== PAPER_SOURCE.ai) {
    return;
  }
  if (meta.ai === 0) {
    window.alert(
      `AI 出题未能生成有效题目，本卷 ${questionCount} 题均由预置题库补齐。请检查 popup 中的 API 密钥与网络。`,
    );
    return;
  }
  if (meta.preset > 0) {
    window.alert(
      `AI 组卷部分失败：本卷 AI ${meta.ai} 题，预置题库补齐 ${meta.preset} 题。`,
    );
  }
}

async function preparePaper(mode, paperSource) {
  if (paperSource === PAPER_SOURCE.preset) {
    exam.paperMeta = { ai: 0, preset: mode.questionCount };
    return buildPaper(EXAM_QUESTIONS, mode.questionCount);
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

export async function startMode(modeId) {
  const mode = EXAM_MODES[modeId];
  if (!mode) {
    return;
  }
  exam.currentMode = mode;
  clearPaperQuestionsForAssist();

  if (modeId === "wrong") {
    const wrongQuestions = shuffle(await PracticeStorage.getWrongQuestions());
    if (!wrongQuestions.length) {
      window.alert(
        "错题本还是空的。先完成一套模拟考或快刷，交卷后会自动收录错题。",
      );
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
    warnAiPaperQuality(exam.paperMeta, mode.questionCount);
  } catch (error) {
    const message = error?.message ?? "组卷失败";
    const useFallback = window.confirm(
      `${message}\n\n是否改用预置题库（${EXAM_QUESTIONS.length} 题）组卷？`,
    );
    if (!useFallback) {
      return;
    }
    exam.paper = buildPaper(EXAM_QUESTIONS, mode.questionCount);
    exam.paperMeta = { ai: 0, preset: mode.questionCount };
    exam.paperSource = PAPER_SOURCE.preset;
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

export async function submitExam(isAuto) {
  if (!exam.paper.length) {
    return;
  }
  if (!isAuto) {
    const unanswered = exam.paper.filter(
      ({ question }) => !exam.answers.get(question.id)?.length,
    ).length;
    const tip =
      unanswered > 0
        ? `还有 ${unanswered} 题未作答，确定交卷吗？`
        : "确定交卷吗？";
    if (!window.confirm(tip)) {
      return;
    }
  }

  stopTimer();
  exam.lastResult = gradePaper(exam.paper, exam.answers, exam.passThreshold);
  await updateWrongBook(exam.lastResult.items);
  clearPaperQuestionsForAssist();
  await clearSession(ui.resumeCard);
  await refreshStartPanel();

  showResultSummary();
  showPanel(ui.resultPanel);
  renderReview();
}

export async function discardSession() {
  clearPaperQuestionsForAssist();
  await clearSession(ui.resumeCard);
  await refreshStartPanel();
}
