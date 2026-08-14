// 参数列表的拖拽排序：只管拖拽交互与索引计算，列表本身由调用方通过 onReorder 改
function createDragSort(onReorder) {
  let dragIndex = null;

  function startDrag(e) {
    const { currentTarget, dataTransfer } = e;
    dragIndex = Number(currentTarget.dataset.index);
    currentTarget.classList.add("dragging");
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
    const dropIndex = Number(currentTarget.dataset.index);
    currentTarget.classList.remove("drag-over");

    if (dragIndex === null || dragIndex === dropIndex) return;

    onReorder(dragIndex, dropIndex);
  }

  function endDrag(e) {
    e.currentTarget.classList.remove("dragging");
    dragIndex = null;
    document
      .querySelectorAll(".drag-over")
      .forEach((el) => el.classList.remove("drag-over"));
  }

  return {
    bindItem(item) {
      item.addEventListener("dragstart", startDrag);
      item.addEventListener("dragover", allowDrop);
      item.addEventListener("dragleave", clearDropHint);
      item.addEventListener("drop", reorderParams);
      item.addEventListener("dragend", endDrag);
    },
  };
}
