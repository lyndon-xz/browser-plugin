import { L2_EXAM } from "./constants.js";

export function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const OPTION_KEY_ORDER = ["A", "B", "C", "D", "E", "F"];

/** 选项按 A/B/C/D 固定顺序展示（与真实考试一致） */
export function orderedOptionKeys(question) {
  const available = new Set(
    (question.options || []).map((option) => option.key),
  );
  return OPTION_KEY_ORDER.filter((key) => available.has(key));
}

/** 按保存的顺序还原选项（续考） */
export function getDisplayOptions(question, optionKeys) {
  const byKey = new Map(
    (question.options || []).map((option) => [option.key, option]),
  );
  return optionKeys.map((key) => byKey.get(key)).filter(Boolean);
}

function sampleByTypeRatio(questions, count) {
  const singles = shuffle(questions.filter((q) => q.type === "single"));
  const multis = shuffle(questions.filter((q) => q.type === "multi"));
  const ratio = singles.length / Math.max(questions.length, 1);
  let singleTake = Math.min(
    singles.length,
    Math.max(0, Math.round(count * ratio)),
  );
  let multiTake = Math.min(multis.length, count - singleTake);

  if (singleTake + multiTake < count) {
    const shortfall = count - singleTake - multiTake;
    if (singleTake < singles.length) {
      const add = Math.min(shortfall, singles.length - singleTake);
      singleTake += add;
    } else if (multiTake < multis.length) {
      multiTake += Math.min(
        count - singleTake - multiTake,
        multis.length - multiTake,
      );
    }
  }

  let picked = [...singles.slice(0, singleTake), ...multis.slice(0, multiTake)];

  if (picked.length < count) {
    const pickedIds = new Set(picked.map((q) => q.id));
    const rest = shuffle(questions.filter((q) => !pickedIds.has(q.id)));
    picked = [...picked, ...rest.slice(0, count - picked.length)];
  }

  return shuffle(picked);
}

function toPaperSlots(picked, optionOrders = {}) {
  return picked.map((question, index) => {
    const stored = optionOrders[question.id];
    const optionKeys =
      Array.isArray(stored) && stored.length
        ? stored
        : orderedOptionKeys(question);
    return { question, index, optionKeys };
  });
}

/**
 * 模拟真实考试：按题库单选/多选比例抽题，再整体打乱题序；选项保持 A/B/C/D 顺序。
 */
export function buildPaper(questions, count = L2_EXAM.questionCount) {
  const picked = sampleByTypeRatio(questions, count);
  return toPaperSlots(picked);
}

/** 题库组卷：优先抽没考过的题，凑不满一卷时用考过的补齐 */
export function buildPaperPreferringUnused(questions, count, usedIds) {
  const unused = questions.filter((question) => !usedIds.has(question.id));
  if (unused.length >= count) {
    return buildPaper(unused, count);
  }

  const used = questions.filter((question) => usedIds.has(question.id));
  const filler = sampleByTypeRatio(used, count - unused.length);
  return buildPaper([...unused, ...filler], count);
}

/** 按 id 顺序组卷（续考 / 错题本），可传入已保存的选项顺序 */
export function buildPaperFromIds(questions, ids, optionOrders = {}) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const picked = ids.map((id) => byId.get(id)).filter(Boolean);
  return toPaperSlots(picked, optionOrders);
}

export function getBankStats(questions) {
  const single = questions.filter((q) => q.type === "single").length;
  return {
    total: questions.length,
    single,
    multi: questions.length - single,
  };
}

export function paperTypeSummary(paper) {
  const single = paper.filter(
    ({ question }) => question.type === "single",
  ).length;
  return { single, multi: paper.length - single };
}

function normalizeSelection(keys) {
  return [...new Set(keys.map((k) => String(k).trim().toUpperCase()))].sort();
}

/** 判单题是否答对（集合完全一致） */
export function isAnswerCorrect(question, selectedKeys) {
  if (!question || !Array.isArray(question.answer)) {
    return false;
  }
  const expected = normalizeSelection(question.answer);
  const picked = normalizeSelection(selectedKeys || []);
  if (expected.length !== picked.length) {
    return false;
  }
  return expected.every((key, i) => key === picked[i]);
}

/** 批改整卷；passCorrect 默认按 L2 40 题，快刷等模式传入各自阈值 */
export function gradePaper(paper, answersByQuestionId, passCorrect) {
  const items = paper.map(({ question, index, optionKeys }) => {
    const selected = answersByQuestionId.get(question.id) || [];
    const isCorrect = isAnswerCorrect(question, selected);
    return {
      index,
      question,
      optionKeys,
      selected: normalizeSelection(selected),
      isCorrect,
    };
  });

  const correctCount = items.filter((item) => item.isCorrect).length;
  const total = items.length;
  const scorePercent =
    total === 0 ? 0 : Math.round((correctCount / total) * 100);
  const threshold =
    passCorrect ?? Math.max(1, Math.ceil(total * (L2_EXAM.passPercent / 100)));
  const isPassed = total > 0 && correctCount >= threshold;

  return {
    items,
    correctCount,
    total,
    scorePercent,
    isPassed,
    passCorrect: threshold,
  };
}

export function formatDuration(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** 错题模式：每题分钟数与 L2 保持一致（90/50） */
export function durationForCount(count) {
  const perQuestion = L2_EXAM.durationMs / L2_EXAM.questionCount;
  return Math.ceil(count * perQuestion);
}

export function passCorrectForCount(count) {
  return Math.max(1, Math.ceil(count * (L2_EXAM.passPercent / 100)));
}
