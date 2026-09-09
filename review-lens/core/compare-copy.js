/** 对照结论在各处的文案，避免 drawer / 弹窗 / 导出各写一套 */

export const UNLOCATABLE_SHORT = "无法在最新代码中定位";

export const UNLOCATABLE_TITLE = "无法在最新代码里找到对应位置";

export function unlocatableDrawerDetail(hasCommits) {
  return hasCommits
    ? "评论之后代码又有改动，按方法名和锚点行都没对上。这不等于代码已删——可能只是改名或挪走了。下面是谁动过这个文件："
    : "评论之后代码又有改动，按方法名和锚点行都没对上，也没查到针对这个文件的提交记录。";
}

export const UNLOCATABLE_EXPORT =
  "无法在最新代码中定位，评论时的片段仅作线索。";

export function discussionsTruncatedMessage(maxLoaded) {
  return `讨论列表过长，只加载了前 ${maxLoaded} 条，这条可能不在其中`;
}
