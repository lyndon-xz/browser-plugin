// GitLab 用 body[data-page] 标注当前控制器动作，比 URL 更能确认"这是 GitLab 的 MR 讨论页"
const MERGE_REQUEST_PAGE = "projects:merge_requests:show";

// data-page 缺失时（老版本或改过模板）退回路径判定，要求 /-/merge_requests/<数字>
const MERGE_REQUEST_PATH = /\/-\/merge_requests\/\d+/;

export function isMergeRequestPage(document, location) {
  const dataPage = document.body?.dataset?.page;
  if (dataPage) return dataPage === MERGE_REQUEST_PAGE;

  return MERGE_REQUEST_PATH.test(location.pathname);
}

/*
 * 从路径取项目与 MR 编号。`/-/` 之前的整段就是项目路径（含嵌套子组），编码后可直接当 API 的 :id
 * 用，省掉一次查 project id（TD-8）。实例部署在子路径下时该前缀会被算进项目路径，本仓库场景不涉及。
 */
export function parseMergeRequestRef(location) {
  const matched = location.pathname.match(/^\/(.+?)\/-\/merge_requests\/(\d+)/);
  if (!matched) return null;

  const [, projectPath, mrIid] = matched;
  // project 是编码后的，可直接当 API 的 :id；projectPath 保留原样，拼附件 URL 用
  return { project: encodeURIComponent(projectPath), projectPath, mrIid };
}
