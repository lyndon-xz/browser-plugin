import { HIDDEN_CLASS } from "../ui-state.js";

// 行内输入框的共同外观由这里统一挂上，各调用方只管尺寸与校验
const INLINE_INPUT_CLASS = "inline-input";

/**
 * 行内编辑的通用生命周期：隐藏展示节点、就地插入 input、回车或失焦提交、Esc 取消。
 * parse 返回 { value } 表示提交，返回 null 表示丢弃——无效或没变化都算丢弃，
 * 要不要给提示由 parse 自己决定，它才知道是哪一种
 */
export function startInlineEdit(editRequest) {
  const { target, createInput, parse, onCommit } = editRequest;

  // target 已隐藏，说明这一处正在编辑中
  if (target.classList.contains(HIDDEN_CLASS)) {
    return;
  }

  const input = createInput();
  input.classList.add(INLINE_INPUT_CLASS);
  target.classList.add(HIDDEN_CLASS);
  target.before(input);
  input.focus();
  input.select();

  let isClosed = false;

  // 解绑 blur 并用 isClosed 守卫：input.remove() 会再触发一次 blur，否则这里跑第二遍
  function close(shouldSave) {
    if (isClosed) {
      return;
    }
    isClosed = true;
    input.removeEventListener("blur", saveAndClose);

    const parsed = shouldSave ? parse(input.value.trim()) : null;
    input.remove();
    target.classList.remove(HIDDEN_CLASS);

    if (parsed) {
      onCommit(parsed.value);
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
