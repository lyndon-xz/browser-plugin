function readClientRect(rect) {
  if (!rect || (rect.width <= 0 && rect.height <= 0)) {
    return null;
  }
  return {
    top: rect.top,
    left: rect.left,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

/** 从 Range 读取视口锚点：水平对齐首行，垂直锚在末行底部（气泡贴在选区下方） */
export function readRangeRect(range) {
  if (!range) {
    return null;
  }

  try {
    const lineRects = [...range.getClientRects()].filter(
      (rect) => rect.width > 0 || rect.height > 0,
    );
    if (lineRects.length > 0) {
      const first = lineRects[0];
      const last = lineRects[lineRects.length - 1];
      return {
        top: first.top,
        left: first.left,
        bottom: last.bottom,
        width: Math.max(first.width, last.width),
        height: last.bottom - first.top,
      };
    }
    return readClientRect(range.getBoundingClientRect());
  } catch (e) {
    return null;
  }
}

/** 选区在视口中的锚点 */
export function readSelectionRect(selection) {
  if (!selection?.rangeCount) {
    return null;
  }
  return readRangeRect(selection.getRangeAt(0));
}
