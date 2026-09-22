/** render.js 写入、drag.js 读回：列表项在参数数组里的序号 */
export const PARAM_INDEX_ATTR = "index";

/** 拖拽手柄的 class，render.js 建节点时用同一个 */
export const DRAG_HANDLE_CLASS = "drag-handle";

const DRAGGING_CLASS = "dragging";
const DROP_HINT_CLASS = "drag-over";

/*
 * 浏览器默认把拖拽源节点截成跟随光标的影像，换成 1×1 透明图抹掉它，拖拽反馈交给
 * .dragging 与插入线。提前加载：dragstart 时图还没解码完，Chrome 会退回默认影像
 */
const emptyDragImage = new Image();
emptyDragImage.src =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

/** 参数列表拖拽排序；索引计算在这里，列表数据由 onReorder 改 */
export function createDragSort(onReorder) {
  let dragIndex = null;

  function startDrag(e, item) {
    const { dataTransfer } = e;
    dragIndex = Number(item.dataset[PARAM_INDEX_ATTR]);
    item.classList.add(DRAGGING_CLASS);
    dataTransfer.effectAllowed = "move";
    dataTransfer.setDragImage(emptyDragImage, 0, 0);
  }

  function allowDrop(e) {
    const { currentTarget } = e;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    // 拖到自己头上落点不变，不画插入线
    if (Number(currentTarget.dataset[PARAM_INDEX_ATTR]) === dragIndex) {
      return;
    }
    currentTarget.classList.add(DROP_HINT_CLASS);
  }

  function clearDropHint(e) {
    e.currentTarget.classList.remove(DROP_HINT_CLASS);
  }

  function reorderParams(e) {
    const { currentTarget } = e;
    e.preventDefault();

    const dropIndex = Number(currentTarget.dataset[PARAM_INDEX_ATTR]);
    currentTarget.classList.remove(DROP_HINT_CLASS);

    if (dragIndex === null || dragIndex === dropIndex) {
      return;
    }

    onReorder(dragIndex, dropIndex);
  }

  function endDrag(item) {
    item.classList.remove(DRAGGING_CLASS);
    dragIndex = null;
    document
      .querySelectorAll(`.${DROP_HINT_CLASS}`)
      .forEach((el) => el.classList.remove(DROP_HINT_CLASS));
  }

  return {
    bindItem(item) {
      const dragHandle = item.querySelector(`.${DRAG_HANDLE_CLASS}`);
      item.draggable = false;
      dragHandle.draggable = true;
      dragHandle.addEventListener("dragstart", (e) => startDrag(e, item));
      item.addEventListener("dragover", allowDrop);
      item.addEventListener("dragleave", clearDropHint);
      item.addEventListener("drop", reorderParams);
      dragHandle.addEventListener("dragend", () => endDrag(item));
    },
  };
}
