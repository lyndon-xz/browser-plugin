import { isAskShortcut, runQuery } from "../../content/assist/entry.js";
import { exam, scheduleSaveSession } from "../core/state.js";
import { isDialogOpen } from "../ui/dialog.js";
import { ui } from "../ui/dom.js";
import { renderQuestion } from "../ui/render-question.js";

/** 考试面板快捷键：← → 切题；⌃⇧A 查答案 */
export function handleExamKeydown(event) {
  // 本监听挂在 capture 阶段，弹窗开着时不让行会吞掉弹窗按钮的 Enter
  if (isDialogOpen()) {
    return;
  }

  if (isAskShortcut(event)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    void runQuery();
    return;
  }

  if (ui.examPanel.hidden || !exam.paper.length) {
    return;
  }
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    if (exam.currentIndex > 0) {
      exam.currentIndex -= 1;
      renderQuestion();
      scheduleSaveSession();
    }
    return;
  }

  if (event.key === "ArrowRight" || event.key === "Enter") {
    event.preventDefault();
    if (exam.currentIndex < exam.paper.length - 1) {
      exam.currentIndex += 1;
      renderQuestion();
      scheduleSaveSession();
    }
    return;
  }
}
