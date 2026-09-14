/** 组卷来源：AI 从手册抽段 / 预置 86 题 */
export const PAPER_SOURCE = {
  ai: "ai",
  preset: "preset",
};

/** 阿里云 Apsara Clouder · 阿里巴巴编码规范（Java）L2 模拟考规则 */
export const L2_EXAM = {
  label: "阿里巴巴编码规范 L2",
  questionCount: 50,
  durationMs: 90 * 60 * 1000,
  passPercent: 80,
  passCorrect: 40,
};

/** 练习模式配置 */
export const EXAM_MODES = {
  l2: {
    id: "l2",
    label: "L2 模拟考",
    desc: "50 题 · 单选/多选混排 · 题序随机 · 90 分钟",
    questionCount: L2_EXAM.questionCount,
    durationMs: L2_EXAM.durationMs,
    passCorrect: L2_EXAM.passCorrect,
  },
  quick: {
    id: "quick",
    label: "15 题快刷",
    desc: "15 题 · 题序随机 · 27 分钟 · 80 分及格",
    questionCount: 15,
    durationMs: 27 * 60 * 1000,
    passCorrect: 12,
  },
  wrong: {
    id: "wrong",
    label: "只练错题",
    desc: "从历史错题集抽题，答对会从错题本移除",
    questionCount: null,
    durationMs: null,
  },
};
