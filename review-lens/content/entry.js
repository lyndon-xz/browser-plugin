import { minimalExtraForRelatedHit } from "../core/comment/related.js";
import { discussionsTruncatedMessage } from "../core/compare-copy.js";
import { buildComparePair, resliceComparePair } from "../core/compare.js";
import { ERROR_KIND, createGitLabClient } from "../core/gitlab/client.js";
import { parseMergeRequestRef } from "../core/gitlab/page.js";
import { MAX_LOADED_DISCUSSIONS } from "../core/gitlab/thread.js";
import { tokenForPage } from "../core/platform/origins.js";
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

const TRUNCATION_NOTICE_CLASS = "review-lens-truncation-notice";

function showDiscussionsTruncationNotice(root) {
  if (root.querySelector(`.${TRUNCATION_NOTICE_CLASS}`)) {
    return;
  }
  const banner = document.createElement("div");
  banner.className = TRUNCATION_NOTICE_CLASS;
  banner.setAttribute("role", "status");
  banner.textContent = discussionsTruncatedMessage(MAX_LOADED_DISCUSSIONS);
  root.prepend(banner);
}

const ensureEntryStyles = () => {
  if (document.getElementById("review-lens-entry-styles")) {
    return;
  }
  const link = document.createElement("link");
  link.id = "review-lens-entry-styles";
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("ui/entries.css");
  document.head.append(link);
};

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

/** 编排入口、评审数据与抽屉；由 bootstrap 在 MR 页挂载 */
export async function init(overrides = {}) {
  const {
    isMountCurrent = () => true,
    origin = window.location.origin,
    location = window.location,
    root = document.body,
    fetchImpl = (...args) => window.fetch(...args),
    loadStyleText = readCss,
    readToken = async () =>
      tokenForPage((await ask(MESSAGE_ACTION.readSettings)).tokens, origin),
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
  // 扩行只重切片段，沿用上次成功打开时的 thread 与对照基准，不依赖 reload 时序
  let lastOpenContext = null;

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
    onWiden: (extraLines, discussionId) =>
      reopen({ discussionId, extraLines, isWiden: true }),
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
    const { discussionId, extraLines = 0, isWiden = false } = request;

    openedDiscussionId = discussionId;
    try {
      await drawer.ensure();
    } catch (error) {
      if (!alive()) {
        return;
      }
      drawer.renderEnsureFailure(error, () =>
        runDetached("打开抽屉失败", () => open(request)),
      );
      return;
    }
    if (!alive()) {
      return;
    }

    // 讨论列表在 init 与 refreshDiscussions 已拉过；每条评论再 reload 会重复打满 MR API

    await threads.whenReady();
    if (!alive()) {
      return;
    }

    if (threads.threadsError) {
      renderLoadFailure(discussionId);
      return;
    }

    const cached =
      isWiden &&
      lastOpenContext?.thread?.discussionId === discussionId &&
      lastOpenContext;
    const thread =
      cached?.thread ??
      threads.threadFor(discussionId) ??
      (lastOpenContext?.thread?.discussionId === discussionId
        ? lastOpenContext.thread
        : null);
    if (!thread) {
      if (!alive()) {
        return;
      }
      drawer.render({
        status: DRAWER_STATUS.failed,
        error: {
          kind: ERROR_KIND.unexpected,
          status: 0,
          message: threads.discussionsTruncated
            ? discussionsTruncatedMessage(MAX_LOADED_DISCUSSIONS)
            : "找不到这条讨论，可能已被删除或尚未加载到。点重试或稍等讨论列表刷新完成后再试。",
        },
        onRetry: () => reopen({ discussionId }),
        onConfigureToken: () => runDetached("打不开设置页", openSettings),
      });
      return;
    }

    if (!isWiden) {
      drawer.render({ status: DRAWER_STATUS.loading, thread });
    }
    try {
      let mrHeadSha = cached?.mrHeadSha ?? threads.mrHeadSha;
      const sourceBranch = cached?.sourceBranch ?? threads.sourceBranch;
      let useReslice = isWiden && cached?.resliceCache;
      if (useReslice) {
        const liveHead = await threads.refreshHead();
        if (!alive()) {
          return;
        }
        if (liveHead) {
          if (liveHead !== cached.mrHeadSha) {
            useReslice = false;
          }
          mrHeadSha = liveHead;
        }
      }
      let pair = useReslice
        ? resliceComparePair(cached.resliceCache, extraLines)
        : await buildComparePair(client, {
            project: ref.project,
            thread,
            mrHeadSha,
            sourceBranch,
            extraLines,
          });
      if (!alive() || openedDiscussionId !== discussionId) {
        return;
      }

      let cache = pair.resliceCache ?? cached?.resliceCache ?? null;
      const autoExtra = minimalExtraForRelatedHit({
        fileLines: cache?.oldLines,
        then: pair.then,
        body: thread.body,
      });
      const effectiveExtra = Math.max(extraLines, autoExtra);
      if (effectiveExtra !== extraLines && cache && pair.then) {
        pair = resliceComparePair(cache, effectiveExtra);
        cache = pair.resliceCache ?? cache;
      }

      const savedCardId =
        isWiden && cached?.savedCardId != null
          ? cached.savedCardId
          : await savedCardIdFor(discussionId);
      if (!alive() || openedDiscussionId !== discussionId) {
        return;
      }

      const { resliceCache, ...compareResult } = pair;
      cache = resliceCache ?? cache;
      const searchLines = cache?.oldLines?.map((text, index) => ({
        number: index + 1,
        text,
      }));
      lastOpenContext = {
        thread,
        mrHeadSha,
        sourceBranch,
        resliceCache: cache,
        savedCardId,
      };
      drawer.render({
        status: DRAWER_STATUS.ready,
        thread,
        ...compareResult,
        extraLines: effectiveExtra,
        savedCardId,
        isWiden,
        searchLines,
      });
    } catch (error) {
      if (!alive() || openedDiscussionId !== discussionId) {
        return;
      }

      drawer.render({
        status: DRAWER_STATUS.failed,
        thread,
        error,
        onRetry: () => reopen({ discussionId, extraLines }),
        onConfigureToken: () => runDetached("打不开设置页", openSettings),
      });
    }
  }

  await threads.reload();
  if (!isMountCurrent()) {
    return () => {};
  }

  // null = 取讨论失败，不挂入口；Set = 只挂代码评论
  let codeDiscussionIds = threads.threadsError ? null : threads.discussionIds;

  const refreshDiscussions = async () => {
    await threads.reload();
    if (!alive()) {
      return;
    }
    codeDiscussionIds = threads.threadsError ? null : threads.discussionIds;
  };

  if (threads.discussionsTruncated) {
    showDiscussionsTruncationNotice(root);
  }

  ensureEntryStyles();

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
    lastOpenContext = null;
    detach();
    drawer.close();
    runDetached("图标没能复位", reportInactive);
  };
}
