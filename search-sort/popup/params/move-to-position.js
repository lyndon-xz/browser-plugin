import { flashInvalid } from "../flash-invalid.js";

import { startInlineEdit } from "./inline-edit.js";

const INVALID_POSITION_HINT_MS = 600;

// 目标位置从 1 起算，不是 1..maxPosition 内的整数就返回 null
function parsePosition(raw, maxPosition) {
  if (!/^\d+$/.test(raw)) {
    return null;
  }

  const parsed = Number(raw);
  if (parsed < 1 || parsed > maxPosition) {
    return null;
  }
  return parsed;
}

/** 序号行内编辑：点击序号输入目标位置（1 起），回车或失焦提交、Esc 取消 */
export function startMoveToPosition(moveRequest) {
  const { indexEl, currentPosition, maxPosition, onCommit } = moveRequest;

  startInlineEdit({
    target: indexEl,

    createInput() {
      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.max = String(maxPosition);
      input.className = "param-index-input";
      input.value = String(currentPosition);
      return input;
    },

    parse(raw) {
      const targetPosition = parsePosition(raw, maxPosition);
      if (targetPosition === null) {
        flashInvalid(indexEl, INVALID_POSITION_HINT_MS);
        return null;
      }
      if (targetPosition === currentPosition) {
        return null;
      }
      return { value: targetPosition };
    },

    onCommit,
  });
}
