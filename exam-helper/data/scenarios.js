import { EXAM_BANK } from "./exam-bank.js";

/** 模拟练习场景注册表；popup 与练习页共用，后续在此追加新场景即可。 */
export const PRACTICE_SCENARIOS = [
  {
    id: EXAM_BANK.id,
    label: EXAM_BANK.label,
    summary: `${EXAM_BANK.material.title} · 模拟考 / 快刷 / 错题本`,
    practicePage: "practice/practice.html",
  },
];

export const DEFAULT_SCENARIO_ID = PRACTICE_SCENARIOS[0].id;

export function getScenario(id) {
  return (
    PRACTICE_SCENARIOS.find((scenario) => scenario.id === id) ??
    PRACTICE_SCENARIOS[0]
  );
}
