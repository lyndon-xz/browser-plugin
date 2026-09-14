import { PARAM_INDEX_ATTR, createDragSort } from "./drag.js";
import { HIDDEN_CLASS } from "../classes.js";
import {
  DELETE_BTN_CLASS,
  PARAM_VALUE_CLASS,
  startEditValue,
} from "./edit-value.js";
import { PARAM_INDEX_CLASS, startMoveToIndex } from "./move-to-index.js";

/** 参数列表渲染与排序（拖拽、序号跳转、改值、删除） */
export function createParamsRenderer(deps) {
  const { params, elements, onDirty } = deps;
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

  function moveParamToIndex(fromIndex, toIndex) {
    if (fromIndex === toIndex) {
      return;
    }
    if (toIndex < 0 || toIndex >= params.length) {
      return;
    }
    const [moved] = params.splice(fromIndex, 1);
    params.splice(toIndex, 0, moved);
    renderParams();
    scrollParamIntoView(toIndex);
    onDirty();
  }

  const dragSort = createDragSort((fromIndex, dropIndex) => {
    const insertAt = fromIndex < dropIndex ? dropIndex - 1 : dropIndex;
    moveParamToIndex(fromIndex, insertAt);
  });

  function renderParams() {
    paramsListEl.innerHTML = "";

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
      const { key: paramKey, defaultValue, isNew } = param;

      const item = document.createElement("div");
      item.className = "param-item";
      item.dataset[PARAM_INDEX_ATTR] = index;

      const indexLabel = document.createElement("span");
      indexLabel.className = PARAM_INDEX_CLASS;
      indexLabel.textContent = String(index + 1);
      indexLabel.title = "点击输入目标位置";
      indexLabel.addEventListener("click", () => {
        startMoveToIndex({
          item,
          currentPosition: index + 1,
          maxPosition: params.length,
          onCommit: (targetPosition) => {
            moveParamToIndex(index, targetPosition - 1);
          },
        });
      });

      const dragHandle = document.createElement("span");
      dragHandle.className = "drag-handle";
      dragHandle.textContent = "≡";
      dragHandle.title = "拖动排序";

      const key = document.createElement("span");
      key.className = "param-key";
      key.textContent = paramKey;
      key.title = paramKey;

      const value = document.createElement("span");
      if (defaultValue == null) {
        value.className = `${PARAM_VALUE_CLASS} empty`;
        value.textContent = "—";
      } else {
        value.className = PARAM_VALUE_CLASS;
        value.textContent = defaultValue;
      }
      value.addEventListener("click", () => {
        startEditValue({
          item,
          initialValue: defaultValue,
          onCommit: (newValue) => {
            if (params[index].defaultValue === newValue) {
              return;
            }
            params[index].defaultValue = newValue;
            renderParams();
            onDirty();
          },
        });
      });

      const deleteBtn = document.createElement("span");
      deleteBtn.className = DELETE_BTN_CLASS;
      deleteBtn.textContent = "×";
      deleteBtn.addEventListener("click", () => {
        params.splice(index, 1);
        renderParams();
        onDirty();
      });

      item.appendChild(indexLabel);
      item.appendChild(dragHandle);
      item.appendChild(key);
      item.appendChild(value);
      item.appendChild(deleteBtn);

      if (isNew) {
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
