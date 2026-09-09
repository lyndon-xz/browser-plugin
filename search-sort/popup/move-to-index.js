import { HIDDEN_CLASS } from "./edit-value.js";

export const PARAM_INDEX_CLASS = "param-index";

const INVALID_HINT_MS = 600;

/*
 * 序号行内编辑：点击序号输入目标位置（1 起），回车或失焦提交、Esc 取消。
 * 非法输入或位置不变时不回调 onCommit。
 */
export function startMoveToIndex(request) {
  const { item, currentPosition, maxPosition, onCommit } = request;

  if (item.querySelector(".param-index-input")) {
    return;
  }

  const indexEl = item.querySelector(`.${PARAM_INDEX_CLASS}`);
  indexEl.classList.add(HIDDEN_CLASS);

  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.max = String(maxPosition);
  input.className = "param-index-input";
  input.value = String(currentPosition);
  input.placeholder = "位置";

  indexEl.before(input);
  input.focus();
  input.select();

  let isClosed = false;

  function showInvalid() {
    indexEl.classList.add("error");
    setTimeout(() => indexEl.classList.remove("error"), INVALID_HINT_MS);
  }

  function close(shouldSave) {
    if (isClosed) {
      return;
    }
    isClosed = true;
    input.removeEventListener("blur", saveAndClose);

    let targetPosition = null;
    if (shouldSave) {
      const raw = input.value.trim();
      if (!/^\d+$/.test(raw)) {
        showInvalid();
      } else {
        const parsed = Number(raw);
        if (parsed < 1 || parsed > maxPosition) {
          showInvalid();
        } else if (parsed !== currentPosition) {
          targetPosition = parsed;
        }
      }
    }

    input.remove();
    indexEl.classList.remove(HIDDEN_CLASS);

    if (targetPosition != null) {
      onCommit(targetPosition);
    }
  }

  function saveAndClose() {
    close(true);
  }

  input.addEventListener("keydown", (e) => {
    const { key } = e;
    if (key === "Enter") {
      e.preventDefault();
      close(true);
    }
    if (key === "Escape") {
      close(false);
    }
  });

  input.addEventListener("blur", saveAndClose);
}
