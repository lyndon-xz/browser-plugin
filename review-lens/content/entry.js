import { discussionsTruncatedMessage } from "../core/compare-copy.js";
import { buildComparePair } from "../core/compare.js";
import { ERROR_KIND, createGitLabClient } from "../core/gitlab/client.js";
import { parseMergeRequestRef } from "../core/gitlab/page.js";
import { MAX_LOADED_DISCUSSIONS } from "../core/gitlab/thread.js";
import { MESSAGE_ACTION, ask } from "../core/platform/messages.js";
import { DRAWER_STATUS } from "../ui/drawer/status.js";

import { createDrawerBridge } from "./drawer-bridge.js";
import { attachEntries } from "./entries.js";
import { runDetached } from "./run-detached.js";
import { createThreads } from "./threads.js";

/*
 * 由 bootstrap 动态 import。这一层是编排：把入口、评审数据、抽屉三块接起来，
 * 并决定「点开一条评论」时依次发生什么。三块各自的实现在同目录的另外几个文件里。
 */

const readCss = async () => {
  const [tokensResponse, drawerResponse] = await Promise.all([
    fetch(chrome.runtime.getURL("ui/tokens.css")),
    fetch(chrome.runtime.getURL("ui/drawer.css")),
  ]);
  if (!tokensResponse.ok || !drawerResponse.ok) {
    throw new Error("抽屉样式加载失败");
  }
  const [tokensText, drawerText] = await Promise.all([
    tokensResponse.text(),
    drawerResponse.text(),
  ]);
  return `${tokensText}\n${drawerText}`;
};

export async function init(overrides = {}) {
  const {
    isMountCurrent = () => true,
    origin = window.location.origin,
    location = window.location,
    root = document.body,
    fetchImpl = (...args) => window.fetch(...args),
    loadStyleText = readCss,
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

  let isActive = true;
  let openedDiscussionId = null;

  const alive = () => isActive && isMountCurrent();

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
    onWiden: (extraLines) => reopen({ extraLines }),
    isAlive: alive,
  });

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
    if (!alive()) {
      return;
    }
    drawer.render({
      status: DRAWER_STATUS.failed,
      error: threads.threadsError,
      onRetry: () =>
        runDetached("重新取数失败", async () => {
          await threads.reload();
          await open({ discussionId });
        }),
      onConfigureToken: () => runDetached("打不开设置页", openSettings),
    });
  }

  async function open(request) {
    const { discussionId, extraLines = 0 } = request;

    openedDiscussionId = discussionId;
    await drawer.ensure();
    if (!alive()) {
      return;
    }

    // 每次打开前刷新 MR head 与讨论列表，避免长时间停留同页后对照基准过期
    await threads.reload();
    if (!alive()) {
      return;
    }

    if (threads.threadsError) {
      renderLoadFailure(discussionId);
      return;
    }

    const thread = threads.threadFor(discussionId);
    if (!thread) {
      if (!alive()) {
        return;
      }
      drawer.render({
        status: DRAWER_STATUS.failed,
        error: {
          kind: ERROR_KIND.notFound,
          status: 0,
          message: threads.discussionsTruncated
            ? discussionsTruncatedMessage(MAX_LOADED_DISCUSSIONS)
            : "找不到这条讨论，可能已被删除或尚未加载到",
        },
        onRetry: () => reopen({ discussionId }),
        onConfigureToken: () => runDetached("打不开设置页", openSettings),
      });
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
      if (!alive() || openedDiscussionId !== discussionId) {
        return;
      }

      const savedCardId = await savedCardIdFor(discussionId);
      if (!alive() || openedDiscussionId !== discussionId) {
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
      if (!alive() || openedDiscussionId !== discussionId) {
        return;
      }

      drawer.render({
        status: DRAWER_STATUS.failed,
        thread,
        error,
        onRetry: () => reopen({ extraLines }),
        onConfigureToken: () => runDetached("打不开设置页", openSettings),
      });
    }
  }

  await threads.reload();
  if (!isMountCurrent()) {
    return () => {};
  }

  let codeDiscussionIds = threads.threadsError ? undefined : threads.discussionIds;

  const refreshDiscussions = async () => {
    await threads.reload();
    if (!alive()) {
      return;
    }
    codeDiscussionIds = threads.threadsError ? undefined : threads.discussionIds;
  };

  const detach = attachEntries({
    root,
    getCodeDiscussionIds: () => codeDiscussionIds,
    onDiscussionsMaybeStale: refreshDiscussions,
    onOpen: (request) => runDetached("打开抽屉失败", () => open(request)),
  });

  if (!isMountCurrent()) {
    detach();
    return () => {};
  }

  runDetached("图标没能点亮", reportActive);

  return () => {
    isActive = false;
    detach();
    drawer.close();
    runDetached("图标没能复位", reportInactive);
  };
}
