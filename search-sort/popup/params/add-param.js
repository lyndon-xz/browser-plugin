import { emptyDefaultToNull } from "../../utils/url.js";
import { HIDDEN_CLASS } from "../classes.js";

const KEY_ERROR_HINT_MS = 1000;

/** 绑定「新增参数」表单与快捷键 */
export function bindAddParamForm(deps) {
  const { params, elements, renderParams, onDirty } = deps;
  const { addSection, addForm, addKey, addValue, addConfirm, addCancel } =
    elements;

  const addBtn = document.getElementById("addBtn");

  addBtn.addEventListener("click", () => {
    addSection.classList.add(HIDDEN_CLASS);
    addForm.classList.remove(HIDDEN_CLASS);
    addKey.value = "";
    addValue.value = "";
    addKey.focus();
  });

  addCancel.addEventListener("click", () => {
    addForm.classList.add(HIDDEN_CLASS);
    addSection.classList.remove(HIDDEN_CLASS);
  });

  addConfirm.addEventListener("click", () => {
    const key = addKey.value.trim();
    if (!key) {
      addKey.focus();
      return;
    }

    if (params.some((param) => param.key === key)) {
      addKey.classList.add("error");
      setTimeout(() => {
        addKey.classList.remove("error");
      }, KEY_ERROR_HINT_MS);
      return;
    }

    params.unshift({
      key,
      defaultValue: emptyDefaultToNull(addValue.value.trim()),
      isNew: true,
    });

    addForm.classList.add(HIDDEN_CLASS);
    addSection.classList.remove(HIDDEN_CLASS);
    renderParams();
    onDirty();
  });

  addKey.addEventListener("keydown", (e) => {
    const { key } = e;
    if (key === "Enter") {
      e.preventDefault();
      addValue.focus();
    }
    if (key === "Escape") {
      addCancel.click();
    }
  });

  addValue.addEventListener("keydown", (e) => {
    const { key } = e;
    if (key === "Enter") {
      e.preventDefault();
      addConfirm.click();
    }
    if (key === "Escape") {
      addCancel.click();
    }
  });
}
