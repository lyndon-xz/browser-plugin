import { extractIdentifiers, locateIdentifiers } from "../core/comment/identifier.js";

import { renderCommentCard, renderReplies } from "./drawer/comment-card.js";
import { renderFailure } from "./drawer/failure.js";
import { renderFoot } from "./drawer/foot.js";
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
import { badgeFor, describeSelection, renderHead, renderNoCode } from "./drawer/verdict.js";

const DEFAULT_WIDTH = 820;

/** 抽屉的三种状态。取数方与渲染方共享取值，不各写字面量 */
export const DRAWER_STATUS = {
  loading: "loading",
  ready: "ready",
  failed: "failed",
};

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
  let width = readWidth() ?? DEFAULT_WIDTH;
  // 默认同步，两侧行数不同会错位，所以留一个开关
  let syncing = readSyncScroll() ?? true;
  /*
   * 笔记与「已存」存在状态里而不是只在 DOM 上：render 会清空重建，
   * 否则切换视图会丢掉用户输入，并让同一条评论存出第二张卡。
   */
  let noteText = "";
  let savedCardId = null;
  let lastState = null;
  // 评论里提到、且代码里真出现了的标识符：chip 与代码内高亮共用同一份，口径只有一处
  let hitIdentifiers = [];

  // 跳到该标识符在代码里出现的第一行，并闪一下标出落点
  function jumpTo(identifier) {
    const located = locateIdentifiers([identifier], lastState.then.lines)[0];
    const line = located?.lines[0];
    if (line) {
      flashLine(shell.root, line);
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
        note: describeSelection(state),
        view,
        isSyncing: syncing,
        onViewChange: switchView,
        onSyncChange: (next) => {
          syncing = next;
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
    if (hasTwoSides(state)) {
      linkScroll(panes, () => syncing);
    }

    drawer.append(
      renderFoot({
        state,
        site,
        note: noteText,
        savedCardId,
        onWiden,
        onSaveCard,
        onFlashLine: (line) => flashLine(shell.root, line),
        onNoteChange: (value) => {
          noteText = value;
        },
        onSaved: (id) => {
          savedCardId = id;
        },
      }),
    );
  }

  function render(state) {
    // 换了另一条评论：上一条的笔记与「已存」都不属于它
    if (state.thread?.discussionId !== lastState?.thread?.discussionId) {
      noteText = "";
      savedCardId = null;
    }
    lastState = state;
    hitIdentifiers = hitsIn(state);

    if (!shell.isMounted()) {
      shell.mount();
    }
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

    drawer.append(renderHead({ thread: state.thread, onClose: close }));
    if (state.thread) {
      /*
       * 评论与回复合成一个可滚动区：它们的高度由别人写的内容决定（长正文、几十条回复、
       * 贴一张长截图），不给上限就会把下面的代码对比区整个顶出视口。
       */
      const read = document.createElement("div");
      read.className = "read";
      read.append(
        renderCommentCard({
          thread: state.thread,
          badge: badgeFor(state),
          site,
          hitIdentifiers,
          onJumpTo: jumpTo,
        }),
      );
      const replies = renderReplies({
        replies: state.thread.replies,
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
    if (state.status === DRAWER_STATUS.ready && !state.then) {
      drawer.append(renderNoCode(state));
    } else if (state.status === DRAWER_STATUS.ready) {
      renderReady(drawer, state);
    }
    if (state.status === DRAWER_STATUS.failed) {
      drawer.append(
        renderFailure({
          error: state.error,
          onRetry: state.onRetry,
          onConfigureToken: state.onConfigureToken,
        }),
      );
    }

    shell.root.append(drawer);
  }

  function close() {
    shell.close();
  }

  return { render, close };
}
