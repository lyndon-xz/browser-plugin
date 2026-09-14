import { Bubble } from "../../shared/ui/bubble.js";
import { getDisplayOptions, paperTypeSummary } from "../core/engine.js";
import {
  countAnswered,
  currentSlot,
  exam,
  getSelection,
  scheduleSaveSession,
  setSelection,
} from "../core/state.js";
import { escapeHtml, ui } from "./dom.js";

function syncProgress() {
  const answered = countAnswered();
  const total = exam.paper.length;
  const pct = total ? Math.round((answered / total) * 100) : 0;
  ui.progressFill.style.width = `${pct}%`;
  ui.answeredText.textContent = `已答 ${answered} 题`;
}

function renderJumpGrid(onJump) {
  ui.jumpGrid.innerHTML = "";
  exam.paper.forEach(({ question }, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "jump-dot";
    btn.textContent = String(index + 1);
    if (index === exam.currentIndex) {
      btn.classList.add("is-current");
    }
    if (getSelection(question.id).length > 0) {
      btn.classList.add("is-answered");
    } else {
      btn.classList.add("is-empty");
    }
    if (question.type === "single") {
      btn.classList.add("is-single");
    }
    btn.addEventListener("click", () => onJump(index));
    ui.jumpGrid.appendChild(btn);
  });
}

export function updateMixTag() {
  const { single, multi } = paperTypeSummary(exam.paper);
  const meta = exam.paperMeta;
  const sourcePart = meta ? ` · 预置 ${meta.preset} · AI ${meta.ai}` : "";
  const coveragePart =
    meta?.coverageTotal > 0
      ? ` · 本卷 ${meta.chunksThisPaper ?? 0} 段 · 累计 ${meta.coverageUsed}/${meta.coverageTotal}`
      : "";
  ui.mixTag.textContent = `组卷 · 单选 ${single} · 多选 ${multi}${sourcePart}${coveragePart}`;
}

function toggleOption(question, optionKey, isSingle) {
  if (isSingle) {
    const current = getSelection(question.id);
    setSelection(
      question.id,
      current.includes(optionKey) ? [] : [optionKey],
      scheduleSaveSession,
    );
  } else {
    const next = new Set(getSelection(question.id));
    if (next.has(optionKey)) {
      next.delete(optionKey);
    } else {
      next.add(optionKey);
    }
    setSelection(question.id, [...next], scheduleSaveSession);
  }
}

/** 渲染当前题、进度条与题号跳转 */
export function renderQuestion() {
  Bubble.hide();
  const slot = currentSlot();
  if (!slot) {
    return;
  }
  const { question, index, optionKeys } = slot;
  const selected = new Set(getSelection(question.id));
  const isSingle = question.type === "single";
  const displayOptions = getDisplayOptions(question, optionKeys);

  ui.progressText.textContent = `第 ${index + 1} / ${exam.paper.length} 题`;
  ui.typeTag.textContent = isSingle ? "单选" : "多选";
  ui.typeTag.classList.toggle("is-single", isSingle);
  ui.typeTag.classList.toggle("is-multi", !isSingle);
  ui.qTitle.textContent = `${index + 1}. ${question.title}`;

  ui.optionsEl.innerHTML = "";
  displayOptions.forEach((option) => {
    const label = document.createElement("label");
    label.className = "option";
    label.dataset.key = option.key;
    if (selected.has(option.key)) {
      label.classList.add("is-selected");
    }

    const mark = document.createElement("span");
    mark.className = `option-mark ${isSingle ? "is-radio" : "is-check"}`;

    const input = document.createElement("input");
    input.type = isSingle ? "radio" : "checkbox";
    input.name = `q-${question.id}`;
    input.value = option.key;
    input.checked = selected.has(option.key);
    input.tabIndex = -1;
    input.addEventListener("change", () => {
      toggleOption(question, option.key, isSingle);
      renderQuestion();
    });

    const text = document.createElement("span");
    text.className = "option-text";
    text.innerHTML = `<span class="option-key">${escapeHtml(option.key)}.</span>${escapeHtml(option.text)}`;

    label.append(mark, input, text);
    ui.optionsEl.appendChild(label);
  });

  ui.prevBtn.disabled = index === 0;
  ui.nextBtn.disabled = index === exam.paper.length - 1;

  syncProgress();
  renderJumpGrid((jumpIndex) => {
    exam.currentIndex = jumpIndex;
    renderQuestion();
    scheduleSaveSession();
  });
}
