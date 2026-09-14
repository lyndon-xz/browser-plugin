import { emptyDefaultToNull } from "../utils/url.js";

/** popup 隐藏态 class */
export const HIDDEN_CLASS = "hidden";
/** 参数默认值展示格 class */
export const PARAM_VALUE_CLASS = "param-value";
/** 参数行删除按钮 class */
export const DELETE_BTN_CLASS = "delete-btn";

/** 默认值的行内编辑：回车或失焦提交，Esc 取消；空串归一为 null */
export function startEditValue(editRequest) {
  const { item, initialValue, onCommit } = editRequest;

  if (item.querySelector(".param-value-input")) {
    return;
  }

  const valueEl = item.querySelector(`.${PARAM_VALUE_CLASS}`);
  valueEl.classList.add(HIDDEN_CLASS);

  const input = document.createElement("input");
  input.className = "param-value-input";
  input.value = initialValue ?? "";
  input.placeholder = "默认值";

  item.insertBefore(input, item.querySelector(`.${DELETE_BTN_CLASS}`));
  input.focus();
  input.select();

  let isClosed = false;

  /*
   * 解绑 blur 并用 isClosed 守卫，避免 input.remove() 触发 blur 后重复执行
   * （NotFoundError 根因）
   */
  function close(shouldSave) {
    if (isClosed) {
      return;
    }
    isClosed = true;
    input.removeEventListener("blur", saveAndClose);

    const value = input.value.trim();
    input.remove();
    valueEl.classList.remove(HIDDEN_CLASS);

    if (shouldSave) {
      onCommit(emptyDefaultToNull(value));
    }
  }

  function saveAndClose() {
    close(true);
  }

  input.addEventListener("keydown", (e) => {
    const { key } = e;
    if (key === "Enter") {
      close(true);
    }
    if (key === "Escape") {
      close(false);
    }
  });

  input.addEventListener("blur", saveAndClose);
}
