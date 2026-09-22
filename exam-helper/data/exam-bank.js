/*
 * 考试资料 + 题库一体入口。组卷时从 material.txt 抽规约让 AI 出题；
 * 划词查题先查预置 questions 与当前卷子的 AI 题，未命中且有选项时走 AI 推理
 */
import { EXAM_QUESTIONS } from "./questions.js";

/** 黄山版手册 — 扩展内随包分发 */
export const L2_MATERIAL = {
  id: "huangshan",
  title: "Java 开发手册（黄山版）",
  pdfPath: "materials/Java开发手册(黄山版).pdf",
  txtPath: "materials/Java开发手册(黄山版).txt",
  note: "题库题目均提炼自此手册【强制】/【推荐】规约",
};

/** L2 考试题库（与资料绑定） */
export const EXAM_BANK = {
  id: "alibaba-java-l2",
  label: "阿里巴巴编码规范 L2",
  material: L2_MATERIAL,
  questions: EXAM_QUESTIONS,
};
