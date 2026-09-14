import { PAPER_SOURCE } from "./constants.js";

const SESSION_KEY = "practiceSession";
const WRONG_KEY = "wrongQuestions";
const LEGACY_WRONG_IDS_KEY = "wrongQuestionIds";
const PAPER_SOURCE_KEY = "practicePaperSource";

function store() {
  return chrome.storage.local;
}

export const PracticeStorage = {
  async loadSession() {
    const result = await store().get(SESSION_KEY);
    const session = result?.[SESSION_KEY];
    if (!session || !Array.isArray(session.questionIds)) {
      return null;
    }
    return session;
  },

  async saveSession(session) {
    if (!session) {
      await store().remove(SESSION_KEY);
      return;
    }
    await store().set({ [SESSION_KEY]: session });
  },

  async clearSession() {
    await store().remove(SESSION_KEY);
  },

  async getPaperSource() {
    const result = await store().get(PAPER_SOURCE_KEY);
    const value = result?.[PAPER_SOURCE_KEY];
    return value === PAPER_SOURCE.preset
      ? PAPER_SOURCE.preset
      : PAPER_SOURCE.ai;
  },

  async savePaperSource(source) {
    const value =
      source === PAPER_SOURCE.preset ? PAPER_SOURCE.preset : PAPER_SOURCE.ai;
    await store().set({ [PAPER_SOURCE_KEY]: value });
  },

  async getWrongQuestions() {
    const result = await store().get([WRONG_KEY, LEGACY_WRONG_IDS_KEY]);
    const stored = result?.[WRONG_KEY];
    if (Array.isArray(stored) && stored.length) {
      return stored.filter((q) => q && q.id != null);
    }

    const legacyIds = result?.[LEGACY_WRONG_IDS_KEY];
    if (!Array.isArray(legacyIds) || !legacyIds.length) {
      return [];
    }

    const { EXAM_BANK } = await import("../../data/exam-bank.js");
    const byId = new Map(EXAM_BANK.questions.map((q) => [q.id, q]));
    const migrated = legacyIds.map((id) => byId.get(id)).filter(Boolean);
    if (migrated.length) {
      await store().set({ [WRONG_KEY]: migrated });
      await store().remove(LEGACY_WRONG_IDS_KEY);
    }
    return migrated;
  },

  async saveWrongQuestions(questions) {
    const list = questions.filter((q) => q && q.id != null);
    await store().set({ [WRONG_KEY]: list });
  },
};
