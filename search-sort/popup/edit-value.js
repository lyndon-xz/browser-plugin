/*
 * 默认值的行内编辑：把 .param-value 换成输入框，回车或失焦提交、Esc 取消。
 * 空串归一为 null 后经 onCommit 交回调用方，本模块不碰参数列表
 */
function startEditValue(editRequest) {
  const { item, initialValue, onCommit } = editRequest;

  if (item.querySelector(".param-value-input")) return;

  const valueEl = item.querySelector(".param-value");
  valueEl.classList.add("hidden");

  const input = document.createElement("input");
  input.className = "param-value-input";
  input.value = initialValue ?? "";
  input.placeholder = "默认值";

  item.insertBefore(input, item.querySelector(".delete-btn"));
  input.focus();
  input.select();

  let isClosed = false;

  /*
   * 解绑 blur 并用 isClosed 守卫，避免 input.remove() 触发 blur 后重复执行
   * （NotFoundError 根因）
   */
  function close(shouldSave) {
    if (isClosed) return;
    isClosed = true;
    input.removeEventListener("blur", saveAndClose);

    const value = input.value.trim();

    input.remove();
    valueEl.classList.remove("hidden");

    if (shouldSave) onCommit(value === "" ? null : value);
  }

  function saveAndClose() {
    close(true);
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") close(true);
    if (e.key === "Escape") close(false);
  });

  input.addEventListener("blur", saveAndClose);
}
