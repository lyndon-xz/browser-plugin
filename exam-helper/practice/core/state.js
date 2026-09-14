import { PracticeStorage } from "./storage.js";

/** 当前练习页运行时状态（单页应用，无多实例） */
export const exam = {
  paper: [],
  currentIndex: 0,
  answers: new Map(),
  deadlineMs: 0,
  timerId: null,
  lastResult: null,
  currentMode: null,
  passThreshold: 0,
  pendingSession: null,
  saveTimer: null,
  paperMeta: null,
  paperSource: null,
};

export function getSelection(questionId) {
  return exam.answers.get(questionId) || [];
}

export function setSelection(questionId, keys, onChange) {
  if (!keys.length) {
    exam.answers.delete(questionId);
  } else {
    exam.answers.set(questionId, keys);
  }
  onChange?.();
}

export function currentSlot() {
  return exam.paper[exam.currentIndex];
}

export function countAnswered() {
  return exam.paper.filter(
    ({ question }) => getSelection(question.id).length > 0,
  ).length;
}

function answersToRecord() {
  const record = {};
  for (const [id, keys] of exam.answers.entries()) {
    record[String(id)] = keys;
  }
  return record;
}

export function answersFromRecord(record) {
  const map = new Map();
  if (!record) {
    return map;
  }
  for (const [id, keys] of Object.entries(record)) {
    if (Array.isArray(keys) && keys.length) {
      const key = /^\d+$/.test(id) ? Number(id) : id;
      map.set(key, keys);
    }
  }
  return map;
}

function optionOrdersFromPaper() {
  const orders = {};
  for (const { question, optionKeys } of exam.paper) {
    orders[question.id] = optionKeys;
  }
  return orders;
}

export function scheduleSaveSession() {
  if (exam.saveTimer) {
    clearTimeout(exam.saveTimer);
  }
  exam.saveTimer = setTimeout(() => {
    void persistSession();
  }, 400);
}

export async function persistSession() {
  if (!exam.paper.length || !exam.currentMode) {
    return;
  }
  await PracticeStorage.saveSession({
    mode: exam.currentMode.id,
    paperSource: exam.paperSource,
    questionIds: exam.paper.map(({ question }) => question.id),
    questions: exam.paper.map(({ question }) => question),
    optionOrders: optionOrdersFromPaper(),
    answers: answersToRecord(),
    currentIndex: exam.currentIndex,
    deadlineMs: exam.deadlineMs,
  });
}

export async function clearSession(resumeCard) {
  if (exam.saveTimer) {
    clearTimeout(exam.saveTimer);
    exam.saveTimer = null;
  }
  await PracticeStorage.clearSession();
  exam.pendingSession = null;
  if (resumeCard) {
    resumeCard.hidden = true;
  }
}

export function resetAnswers() {
  exam.answers = new Map();
}
