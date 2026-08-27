import { buildComparePair } from "../core/compare.js";
import { createGitLabClient } from "../core/gitlab/client.js";
import { parseMergeRequestRef } from "../core/gitlab/page.js";
import { MESSAGE_ACTION, ask } from "../core/platform/messages.js";
import { DRAWER_STATUS } from "../ui/drawer.js";

import { createDrawerBridge } from "./drawer-bridge.js";
import { attachEntries } from "./entries.js";
import { runDetached } from "./run-detached.js";
import { createThreads } from "./threads.js";

/*
 * 由 bootstrap 动态 import。这一层是编排：把入口、评审数据、抽屉三块接起来，
 * 并决定「点开一条评论」时依次发生什么。三块各自的实现在同目录的另外几个文件里。
 */

const readCss = async () => {
  const response = await fetch(chrome.runtime.getURL("ui/drawer.css"));
  return response.text();
};

export async function init(overrides = {}) {
  const {
    origin = window.location.origin,
    location = window.location,
    root = document.body,
    fetchImpl = (...args) => window.fetch(...args),
    loadStyleText = readCss,
    // 令牌只在宿主页登录态被拒时才用得上，且只取当前站点的那一个
    readToken = async () =>
      (await ask(MESSAGE_ACTION.readSettings)).tokens?.[origin] ?? null,
    readSettings = () => ask(MESSAGE_ACTION.readSettings),
    writeSettings = (patch) => ask(MESSAGE_ACTION.writeSettings, { patch }),
    saveCard = (card) => ask(MESSAGE_ACTION.saveCard, { card }),
    reportActive = () => ask(MESSAGE_ACTION.pageActive),
    reportInactive = () => ask(MESSAGE_ACTION.pageInactive),
    findCard = (source) => ask(MESSAGE_ACTION.findCard, { source }),
    openSettings = () => ask(MESSAGE_ACTION.openSettings),
  } = overrides;

  const ref = parseMergeRequestRef(location);
  if (!ref) {
    return () => {};
  }

  const client = createGitLabClient({ origin, fetch: fetchImpl, readToken });
  const threads = createThreads({ client, ref });

  let openedDiscussionId = null;

  // open 自己会把失败渲染成失败态，这里只负责不把 Promise 漏出去
  const reopen = (options) =>
    runDetached("重新取数失败", () =>
      open({ discussionId: openedDiscussionId, ...options }),
    );

  const drawer = createDrawerBridge({
    ref,
    origin,
    loadStyleText,
    readSettings,
    writeSettings,
    saveCard,
    // 展开/折叠要重新取数：片段与完整方法体是同一文件的不同截取，只差上下多看多少行
    onWiden: (extraLines) => reopen({ extraLines }),
  });

  // 这条评论存过卡没有：查不到不影响对照本身，按没存过渲染
  async function savedCardIdFor(discussionId) {
    try {
      const saved = await findCard({
        origin,
        project: ref.project,
        mrIid: Number(ref.mrIid),
        discussionId,
      });
      return saved?.id ?? null;
    } catch {
      return null;
    }
  }

  function renderLoadFailure(discussionId) {
    drawer.render({
      status: DRAWER_STATUS.failed,
      error: threads.error,
      // 入口在取讨论失败时是全量挂的，重取成功后已有的入口照样能用，不必重挂
      onRetry: async () => {
        await threads.reload();
        await open({ discussionId });
      },
      onConfigureToken: openSettings,
    });
  }

  async function open(request) {
    const { discussionId, extraLines = 0 } = request;

    openedDiscussionId = discussionId;
    await drawer.ensure();

    if (threads.error) {
      renderLoadFailure(discussionId);
      return;
    }

    const thread = threads.threadFor(discussionId);
    if (!thread) {
      return;
    }

    drawer.render({ status: DRAWER_STATUS.loading, thread });
    try {
      const pair = await buildComparePair(client, {
        project: ref.project,
        thread,
        mrHeadSha: threads.mrHeadSha,
        sourceBranch: threads.sourceBranch,
        extraLines,
      });
      // 连点两条评论时先发的可能后返回；过期的响应直接丢弃，否则会盖掉当前这条
      if (openedDiscussionId !== discussionId) {
        return;
      }

      const savedCardId = await savedCardIdFor(discussionId);
      if (openedDiscussionId !== discussionId) {
        return;
      }

      drawer.render({
        status: DRAWER_STATUS.ready,
        thread,
        ...pair,
        extraLines,
        savedCardId,
      });
    } catch (error) {
      if (openedDiscussionId !== discussionId) {
        return;
      }

      drawer.render({
        status: DRAWER_STATUS.failed,
        thread,
        error,
        onRetry: () => reopen({ extraLines }),
        onConfigureToken: openSettings,
      });
    }
  }

  await threads.reload();

  const detach = attachEntries({
    root,
    // 取讨论失败时不筛选：全量挂入口，让用户点开看到失败原因
    codeDiscussionIds: threads.error ? undefined : threads.discussionIds,
    onOpen: open,
  });

  // 告诉后台「这一页插件真的挂上了」，工具栏图标才点亮；上报失败不影响已挂好的入口
  runDetached("图标没能点亮", reportActive);

  return () => {
    detach();
    drawer.close();
    // 离开这一页后图标不该还亮着；上报失败不影响卸载本身
    runDetached("图标没能复位", reportInactive);
  };
}
