import { emptyDefaultToNull } from "../../utils/url.js";
import { startInlineEdit } from "./inline-edit.js";

/** 默认值的行内编辑：回车或失焦提交，Esc 取消；空串归一为 null */
export function startEditValue(editRequest) {
  const { valueEl, initialValue, onCommit } = editRequest;

  startInlineEdit({
    target: valueEl,

    createInput() {
      const input = document.createElement("input");
      input.className = "param-value-input";
      input.value = initialValue ?? "";
      input.placeholder = "默认值";
      return input;
    },

    parse: (raw) => ({ value: emptyDefaultToNull(raw) }),
    onCommit,
  });
}
