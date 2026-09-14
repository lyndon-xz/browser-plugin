/** 无法在最新代码中定位（短文案） */
export const UNLOCATABLE_SHORT = "无法在最新代码中定位";

/** 无法在最新代码里找到对应位置（抽屉标题） */
export const UNLOCATABLE_TITLE = "无法在最新代码里找到对应位置";

/** 无法定位时抽屉详情文案；hasCommits 决定是否提示下方提交线索 */
export function unlocatableDrawerDetail(hasCommits) {
  return hasCommits
    ? "评论之后代码又有改动，按方法名和锚点行都没对上。这不等于代码已删——可能只是改名或挪走了。下面是谁动过这个文件："
    : "评论之后代码又有改动，按方法名和锚点行都没对上，也没查到针对这个文件的提交记录。";
}

/** 导出 Markdown 时「无法定位」段的固定文案 */
export const UNLOCATABLE_EXPORT =
  "无法在最新代码中定位，评论时的片段仅作线索。";

/** 讨论列表被分页截断时的用户提示 */
export function discussionsTruncatedMessage(maxLoaded) {
  return `讨论列表过长，只加载了前 ${maxLoaded} 条，这条可能不在其中`;
}

/** 提交线索 API 失败时的补充说明 */
export const COMMITS_FETCH_FAILED_NOTE =
  "没能拉到提交记录（可能是权限或网络），下面的线索可能不完整。";
