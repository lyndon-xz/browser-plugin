import { HIDDEN_CLASS } from "../ui-state.js";

import { DRAG_HANDLE_CLASS, PARAM_INDEX_ATTR, createDragSort } from "./drag.js";
import { startEditValue } from "./edit-value.js";
import { startMoveToPosition } from "./move-to-position.js";

const PARAM_INDEX_CLASS = "param-index";
const PARAM_VALUE_CLASS = "param-value";
const DELETE_BTN_CLASS = "delete-btn";

/** 参数列表渲染与排序（拖拽、序号跳转、改值、删除） */
export function createParamsRenderer(deps) {
  const { store, elements, onDirty } = deps;
  const { paramsListEl, addSection, stateBox, stateTitle, stateDesc } =
    elements;

  function showState(stateText) {
    const { title, desc } = stateText;

    stateTitle.textContent = title;
    stateDesc.textContent = desc;
    stateBox.classList.remove(HIDDEN_CLASS);
    paramsListEl.classList.add(HIDDEN_CLASS);
  }

  function hideState() {
    stateBox.classList.add(HIDDEN_CLASS);
    paramsListEl.classList.remove(HIDDEN_CLASS);
  }

  function scrollParamIntoView(index) {
    requestAnimationFrame(() => {
      paramsListEl.children[index]?.scrollIntoView({ block: "nearest" });
    });
  }

  function moveParam(fromIndex, toIndex) {
    if (!store.move(fromIndex, toIndex)) {
      return;
    }
    renderParams();
    scrollParamIntoView(toIndex);
    onDirty();
  }

  const dragSort = createDragSort((fromIndex, dropIndex) => {
    // 插入线画在目标项上边框，落点就是目标项原来的位置
    moveParam(fromIndex, fromIndex < dropIndex ? dropIndex - 1 : dropIndex);
  });

  function renderParams() {
    paramsListEl.innerHTML = "";
    const params = store.list();

    if (params.length === 0) {
      showState({
        title: "当前 URL 没有查询参数",
        desc: "可以手动新增，给参数设上默认值",
      });
      addSection.classList.remove(HIDDEN_CLASS);
      return;
    }

    hideState();

    params.forEach((param, index) => {
      const item = document.createElement("div");
      item.className = "param-item";
      item.dataset[PARAM_INDEX_ATTR] = index;

      const indexLabel = document.createElement("span");
      indexLabel.className = PARAM_INDEX_CLASS;
      indexLabel.textContent = String(index + 1);
      indexLabel.title = "点击输入目标位置";
      indexLabel.addEventListener("click", () => {
        startMoveToPosition({
          indexEl: indexLabel,
          currentPosition: index + 1,
          maxPosition: store.count(),
          onCommit: (targetPosition) => {
            moveParam(index, targetPosition - 1);
          },
        });
      });

      const dragHandle = document.createElement("span");
      dragHandle.className = DRAG_HANDLE_CLASS;
      dragHandle.textContent = "≡";
      dragHandle.title = "拖动排序";

      const key = document.createElement("span");
      key.className = "param-key";
      key.textContent = param.key;
      key.title = param.key;

      const value = document.createElement("span");
      const { defaultValue } = param;
      if (defaultValue === null) {
        value.className = `${PARAM_VALUE_CLASS} empty`;
        value.textContent = "—";
      } else {
        value.className = PARAM_VALUE_CLASS;
        value.textContent = defaultValue;
      }
      value.addEventListener("click", () => {
        startEditValue({
          valueEl: value,
          initialValue: defaultValue,
          onCommit: (newValue) => {
            if (!store.setDefaultValue(index, newValue)) {
              return;
            }
            renderParams();
            onDirty();
          },
        });
      });

      const deleteBtn = document.createElement("span");
      deleteBtn.className = DELETE_BTN_CLASS;
      deleteBtn.textContent = "×";
      deleteBtn.addEventListener("click", () => {
        store.removeAt(index);
        renderParams();
        onDirty();
      });

      item.appendChild(indexLabel);
      item.appendChild(dragHandle);
      item.appendChild(key);
      item.appendChild(value);
      item.appendChild(deleteBtn);

      if (param.isNew) {
        const badge = document.createElement("span");
        badge.className = "new-badge";
        badge.textContent = "新";
        item.appendChild(badge);
      }

      dragSort.bindItem(item);
      paramsListEl.appendChild(item);
    });
  }

  return { renderParams, showState };
}
