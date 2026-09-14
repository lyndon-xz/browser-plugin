import { ERROR_KIND } from "../../core/gitlab/client.js";

// 失败态文案：机器原因 + 人话结论 + 出路
const EXPLANATION = {
  [ERROR_KIND.unauthenticated]: {
    reason: "登录态已失效",
    title: "GitLab 不认这个会话了",
    detail:
      "取代码需要你在 GitLab 的登录身份。在新标签页登录一次再回来重试；如果这个实例关闭了会话取数，改用访问令牌。",
    canUseToken: true,
  },
  [ERROR_KIND.forbidden]: {
    reason: "无权访问",
    title: "这个仓库你没有读权限",
    detail:
      "GitLab 拒绝了这次读取。找项目负责人开权限，或换一个你有权限的 MR。",
    canUseToken: false,
  },
  [ERROR_KIND.notFound]: {
    reason: "内容不存在",
    title: "这个文件或提交找不到了",
    detail:
      "评论指向的提交可能已被 force push 覆盖，或文件已改名。可以直接去 GitLab 看这条评论的原始位置。",
    canUseToken: false,
  },
  [ERROR_KIND.server]: {
    reason: "服务端出错",
    title: "GitLab 这次没返回结果",
    detail:
      "服务端报错，通常过一会儿就好。重试一次；持续失败就是实例本身的问题。",
    canUseToken: false,
  },
  [ERROR_KIND.network]: {
    reason: "请求没发出去",
    title: "连不上 GitLab",
    detail: "网络中断或需要走内网。确认能正常打开 GitLab 页面后重试。",
    canUseToken: false,
  },
  [ERROR_KIND.unexpected]: {
    reason: "GitLab 拒绝了这次请求",
    title: "这次取数没成功，原因不在登录态上",
    detail:
      "可能是请求太频繁被限流，或这个实例的接口与预期不同。稍后重试；一直如此的话把控制台里 [review-lens] 的报错发出来。",
  },
};

// 没有接上处理器就不渲染按钮，避免留下一个点了没反应的出口
function actionButton(label, handler) {
  if (!handler) {
    return null;
  }

  const button = document.createElement("button");
  button.className = "btn";
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

// 认不出的错误也要给出结论和出口
const UNKNOWN = {
  reason: "未知错误",
  title: "这一步没能完成",
  detail:
    "插件收到了一个预料之外的错误。重试一次；持续失败请看浏览器控制台里 [review-lens] 开头的日志。",
  canUseToken: false,
};

/** 取数或构建失败时的说明与重试/配令牌出口 */
export function renderFailure(request) {
  const { error, onRetry, onConfigureToken } = request;

  const explanation = EXPLANATION[error.kind] ?? UNKNOWN;

  const block = document.createElement("section");
  block.className = "failure";

  const reason = document.createElement("span");
  reason.className = "failure-code";
  reason.textContent = error.status
    ? `${error.status} · ${explanation.reason}`
    : explanation.reason;

  const title = document.createElement("strong");
  title.textContent = explanation.title;

  const detail = document.createElement("p");
  detail.textContent = error.message ?? explanation.detail;

  const actions = document.createElement("div");
  actions.className = "failure-actions";
  actions.append(
    ...[
      actionButton("重试", onRetry),
      explanation.canUseToken
        ? actionButton("配置访问令牌", onConfigureToken)
        : null,
    ].filter(Boolean),
  );

  block.append(reason, title, detail, actions);
  return block;
}
