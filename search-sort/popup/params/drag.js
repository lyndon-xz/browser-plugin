/** popup.js 读写同一份：列表项在参数数组里的序号 */
export const PARAM_INDEX_ATTR = "index";

/** 参数列表拖拽排序；索引计算在这里，列表数据由 onReorder 改 */
export function createDragSort(onReorder) {
  let dragIndex = null;

  function startDrag(e, item) {
    const { dataTransfer } = e;
    dragIndex = Number(item.dataset[PARAM_INDEX_ATTR]);
    item.classList.add("dragging");
    dataTransfer.effectAllowed = "move";
  }

  function allowDrop(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    e.currentTarget.classList.add("drag-over");
  }

  function clearDropHint(e) {
    e.currentTarget.classList.remove("drag-over");
  }

  function reorderParams(e) {
    e.preventDefault();

    const { currentTarget } = e;
    const dropIndex = Number(currentTarget.dataset[PARAM_INDEX_ATTR]);
    currentTarget.classList.remove("drag-over");

    if (dragIndex === null || dragIndex === dropIndex) {
      return;
    }

    onReorder(dragIndex, dropIndex);
  }

  function endDrag(item) {
    item.classList.remove("dragging");
    dragIndex = null;
    document
      .querySelectorAll(".drag-over")
      .forEach((el) => el.classList.remove("drag-over"));
  }

  return {
    bindItem(item) {
      const dragHandle = item.querySelector(".drag-handle");
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
