/** 页面内确认 / 提示弹窗，替代 window.confirm 与 window.alert */

import { escapeHtml } from "../../shared/utils/html.js";

function buildMask(options) {
  const { title, message, confirmText, cancelText } = options;
  const mask = document.createElement("div");
  mask.className = "dialog-mask";
  const descHtml = message
    ? `<p class="dialog-desc" id="dialog-desc">${escapeHtml(message)}</p>`
    : "";
  const cancelHtml = cancelText
    ? `<button type="button" class="btn" data-act="cancel">${escapeHtml(cancelText)}</button>`
    : "";
  mask.innerHTML = `
    <div
      class="dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      ${message ? 'aria-describedby="dialog-desc"' : ""}
    >
      <p class="dialog-title" id="dialog-title">${escapeHtml(title)}</p>
      ${descHtml}
      <div class="dialog-actions">
        ${cancelHtml}
        <button type="button" class="btn primary" data-act="confirm">${escapeHtml(confirmText)}</button>
      </div>
    </div>
  `;
  return mask;
}

let active = null;

/*
 * 弹出一个模态框，resolve 用户是否点了主按钮。
 * 不传 cancelText 即为单按钮的提示框。
 */
function open(options) {
  const { title, message = "", confirmText, cancelText = "" } = options;
  active?.settle(false);

  const mask = buildMask({ title, message, confirmText, cancelText });
  const lastFocused = document.activeElement;
  document.body.appendChild(mask);
  document.body.classList.add("is-dialog-open");

  return new Promise((resolve) => {
    const settle = (result) => {
      if (active?.mask !== mask) {
        return;
      }
      active = null;
      mask.remove();
      document.body.classList.remove("is-dialog-open");
      lastFocused?.focus?.();
      resolve(result);
    };
    active = { mask, settle };

    mask.addEventListener("click", (event) => {
      if (event.target === mask) {
        settle(false);
        return;
      }
      const act = event.target.closest("[data-act]")?.dataset.act;
      if (act) {
        settle(act === "confirm");
      }
    });

    // Enter 交给按钮的原生 click，焦点在哪个按钮就执行哪个
    const focusables = [...mask.querySelectorAll("button")];
    mask.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        settle(false);
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      event.preventDefault();
      const step = event.shiftKey ? -1 : 1;
      const from = focusables.indexOf(document.activeElement);
      const next = (from + step + focusables.length) % focusables.length;
      focusables[next].focus();
    });

    mask.querySelector('[data-act="confirm"]').focus();
  });
}

export function confirmDialog(options) {
  const { confirmText = "确定", cancelText = "取消" } = options;
  return open({ ...options, confirmText, cancelText });
}

export async function alertDialog(options) {
  const { confirmText = "知道了" } = options;
  await open({ ...options, confirmText });
}

/**
 * 按「取消」收掉当前弹窗。
 * 供不经过弹窗的流程出口使用，否则遮罩会留在已经流转到下一状态的页面上。
 */
export function closeDialog() {
  active?.settle(false);
}

/** 弹窗开着时页面快捷键应让行，避免 Enter / ← → 被考试面板抢走 */
export function isDialogOpen() {
  return active !== null;
}
