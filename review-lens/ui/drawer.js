import {
  extractIdentifiers,
  locateIdentifiers,
  pickJumpLine,
} from "../core/comment/identifier.js";

import { renderCommentCard, renderReplies } from "./drawer/comment.js";
import { renderFailure } from "./drawer/failure.js";
import { renderFoot } from "./drawer/foot.js";
import { PANE_SIDE } from "./drawer/code-pane.js";
import {
  VIEW,
  flashLine,
  hasTwoSides,
  linkScroll,
  readScroll,
  renderPanes,
  renderSpine,
  restoreScroll,
} from "./drawer/panes.js";
import { createShell } from "./drawer/shell.js";
import { DRAWER_STATUS } from "./drawer/status.js";
import {
  badgeFor,
  describeSelection,
  renderHead,
  renderNoCode,
} from "./drawer/verdict.js";

const DEFAULT_DRAWER_WIDTH_PX = 820;

/**
 * 编排层：持有全部可变状态，把每一段该显示什么交给 drawer/ 下的渲染模块。
 * 那些模块都是纯函数，要改状态只能通过这里传下去的回调，改动点因此收在这一个文件里。
 *
 * styleText 由调用方读 ui/drawer.css 后传进来，这样本模块不依赖 chrome.* 也能测。
 */
export function createDrawer(options) {
  const {
    styleText,
    // { origin, projectPath }：解析评论里项目相对的 /uploads/ 附件用
    site = null,
    readView = () => null,
    writeView = () => {},
    onWiden = () => {},
    onSaveCard = async () => {},
    readWidth = () => null,
    writeWidth = () => {},
    readSyncScroll = () => null,
    writeSyncScroll = () => {},
  } = options;

  const shell = createShell({ styleText, onDismiss: () => close() });

  // 默认上下堆叠：并排时每栏只剩约 40 字符，Java 行普遍 60–100 字符，几乎每行都要折行
  let view = readView() ?? VIEW.stacked;
  let width = readWidth() ?? DEFAULT_DRAWER_WIDTH_PX;
  // 默认同步，两侧行数不同会错位，所以留一个开关
  let isSyncScrollEnabled = readSyncScroll() ?? true;
  /*
   * 笔记与「已存」存在状态里而不是只在 DOM 上：render 会清空重建，
   * 否则切换视图会丢掉用户输入，并让同一条评论存出第二张卡。
   */
  let noteText = "";
  let savedCardId = null;
  let lastState = null;
  // 评论里提到、且代码里真出现了的标识符：chip 与代码内高亮共用同一份，口径只有一处
  let hitIdentifiers = [];
  let unlinkScroll = null;
  let pendingFlashLine = null;

  function extraLinesNeeded(then, line) {
    if (!then || line == null) {
      return 0;
    }
    if (line >= then.rangeStart && line <= then.rangeEnd) {
      return 0;
    }
    if (line < then.rangeStart) {
      return then.rangeStart - line;
    }
    return line - then.rangeEnd;
  }

  // 相关行与 chip 都指向评论时文件；行不在当前片段里时先扩行再闪
  function ensureLineVisible(line) {
    if (
      flashLine(shell.root, line, { side: PANE_SIDE.then }) ||
      !lastState?.then
    ) {
      pendingFlashLine = null;
      return;
    }

    const need = extraLinesNeeded(lastState.then, line);
    if (need > 0 && lastState.thread) {
      pendingFlashLine = line;
      onWiden(
        (lastState.extraLines ?? 0) + need,
        lastState.thread.discussionId,
      );
    }
  }

  function finishPendingFlash() {
    if (pendingFlashLine == null) {
      return;
    }
    const line = pendingFlashLine;
    if (flashLine(shell.root, line, { side: PANE_SIDE.then })) {
      pendingFlashLine = null;
    }
  }

  // 跳到该标识符在代码里出现的那一行，并闪一下标出落点
  function jumpTo(identifier) {
    const lines = lastState.searchLines ?? lastState.then.lines;
    const located = locateIdentifiers([identifier], lines)[0];
    const line = pickJumpLine(located?.lines, lastState.then?.anchorLine);
    if (line) {
      ensureLineVisible(line);
    }
  }

  // 换布局要整块重绘，所以先记下滚动位置、重绘完再按比例还原
  function switchView(next) {
    const wasAt = readScroll(shell.root);
    view = next;
    writeView(next);
    render(lastState);
    restoreScroll(shell.root, wasAt);
  }

  function hitsIn(state) {
    if (!state.then) {
      return [];
    }

    return locateIdentifiers(
      extractIdentifiers(state.thread?.body).map((item) => item.text),
      state.then.lines,
    )
      .filter((located) => located.lines.length)
      .map((located) => located.text);
  }

  function renderReady(drawer, state) {
    drawer.append(
      renderSpine({
        state,
        selectionText: describeSelection(state),
        view,
        isSyncScrollEnabled,
        onViewChange: switchView,
        onSyncChange: (next) => {
          isSyncScrollEnabled = next;
          writeSyncScroll(next);
        },
      }),
    );

    const panes = renderPanes({
      state,
      view,
      hitIdentifiers,
      // 右侧没有第二份代码时摆结论
      renderRight: renderNoCode,
    });
    drawer.append(panes);
    // 同步是让两侧停在对应的那段代码上，两种布局都成立
    unlinkScroll?.();
    unlinkScroll = hasTwoSides(state)
      ? linkScroll(panes, () => isSyncScrollEnabled)
      : null;

    if (state.scrollWasAt?.length) {
      restoreScroll(shell.root, state.scrollWasAt);
    }

    drawer.append(
      renderFoot({
        state,
        site,
        note: noteText,
        savedCardId,
        onWiden,
        onSaveCard,
        onFlashLine: ensureLineVisible,
        onNoteChange: (value) => {
          noteText = value;
        },
        onSaved: (id) => {
          savedCardId = id;
        },
      }),
    );

    finishPendingFlash();
  }

  function render(state) {
    const { thread, status, then, error, onRetry, onConfigureToken } = state;

    // 换了另一条评论：上一条的笔记与「已存」都不属于它
    if (thread?.discussionId !== lastState?.thread?.discussionId) {
      noteText = "";
      savedCardId = null;
      pendingFlashLine = null;
    }
    lastState = state;
    hitIdentifiers = hitsIn(state);

    if (!shell.isMounted()) {
      shell.mount();
    }
    const scrollWasAt =
      state.isWiden && shell.isMounted() ? readScroll(shell.root) : null;
    shell.clearContent();

    const drawer = document.createElement("aside");
    drawer.className = "drawer";
    drawer.style.width = `${width}px`;
    shell.attachGrip(drawer, {
      width,
      onResize: (next) => {
        width = next;
      },
      onCommit: writeWidth,
    });

    drawer.append(renderHead({ thread, onClose: close }));
    if (thread) {
      /*
       * 评论与回复合成一个可滚动区：它们的高度由别人写的内容决定（长正文、几十条回复、
       * 贴一张长截图），不给上限就会把下面的代码对比区整个顶出视口。
       */
      const read = document.createElement("div");
      read.className = "read";
      read.append(
        renderCommentCard({
          thread,
          badge: badgeFor(state),
          site,
          hitIdentifiers,
          onJumpTo: jumpTo,
        }),
      );
      const replies = renderReplies({
        replies: thread.replies,
        site,
        hitIdentifiers,
        onJumpTo: jumpTo,
      });
      if (replies) {
        read.append(replies);
      }
      drawer.append(read);
    }

    /*
     * 连评论时那一侧都定位不到：没有片段可展示，这一态只给结论，不给代码。
     * 少了这一支，下面的渲染函数会读 state.then 抛错。
     */
    if (status === DRAWER_STATUS.loading) {
      const loading = document.createElement("section");
      loading.className = "loading";
      const text = document.createElement("p");
      text.textContent = "正在取代码与对比…";
      loading.append(text);
      drawer.append(loading);
    } else if (status === DRAWER_STATUS.ready && !then) {
      drawer.append(renderNoCode(state));
      drawer.append(
        renderFoot({
          state,
          site,
          note: noteText,
          savedCardId,
          onWiden,
          onSaveCard,
          onFlashLine: ensureLineVisible,
          onNoteChange: (value) => {
            noteText = value;
          },
          onSaved: (id) => {
            savedCardId = id;
          },
        }),
      );
    } else if (status === DRAWER_STATUS.ready) {
      renderReady(drawer, { ...state, scrollWasAt });
    }
    if (status === DRAWER_STATUS.failed) {
      drawer.append(
        renderFailure({
          error,
          onRetry,
          onConfigureToken,
        }),
      );
    }

    shell.root.append(drawer);
    shell.focusPanel(drawer);
  }

  function close() {
    unlinkScroll?.();
    unlinkScroll = null;
    shell.close();
  }

  return { render, close };
}
