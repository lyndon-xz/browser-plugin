import { createGitLabClient } from "../core/gitlab.js";
import { parseMergeRequestRef } from "../core/page.js";
import { buildComparePair } from "../core/compare.js";
import { MESSAGE_ACTION, ask } from "../core/messages.js";
import { loadMergeRequest, loadThreads } from "../core/thread.js";
import { createDrawer } from "../ui/drawer.js";

// 由 bootstrap 动态 import：在每条代码评审主题旁挂入口并唤起抽屉

export const ENTRY_CLASS = "review-lens-entry";

/*
 * 锚点是讨论容器而不是评论节点，依据是内网实例上的实测：主题折叠时容器内一个 note 元素都没有
 * （notesInside: 0），而 .discussion-actions（装着「显示主题」）始终在且可见。用 note 当锚点
 * 会漏掉全部折叠主题——恰恰是本产品最该处理的那批。
 */
export const DISCUSSION_SELECTOR = "[data-discussion-id]";
const ACTIONS_SELECTOR = ".discussion-actions";

/*
 * 入口按钮挂在宿主页里、拿不到抽屉那份 Shadow DOM 样式，所以按 design.md §4.1 用内联样式：
 * 左侧一根琥珀→青瓷渐变竖条是全产品唯一的品牌标记。用内联而不是往宿主页插 <style>，
 * 是为了不留下自己以外的任何痕迹（V-15）。
 */
function createEntry(discussionId, onOpen) {
  const button = document.createElement("button");
  button.className = ENTRY_CLASS;
  button.type = "button";
  button.style.cssText = [
    "display:inline-flex",
    "gap:5px",
    "align-items:center",
    "height:24px",
    "margin-right:6px",
    "padding:0 8px",
    "font:12px/1 inherit",
    "color:#5a6579",
    "background:#fff",
    "border:1px solid #e4e8f2",
    "border-radius:5px",
    "cursor:pointer",
  ].join(";");

  const brand = document.createElement("span");
  brand.style.cssText =
    "width:3px;height:11px;border-radius:2px;background:linear-gradient(#a8710f 50%,#147b5c 50%)";

  const label = document.createElement("span");
  label.textContent = "解读";

  button.append(brand, label);
  // 只把 id 交出去，代码一律走 API 取——不从宿主页读 diff 文本
  button.addEventListener("click", () => onOpen({ discussionId }));
  return button;
}

/*
 * codeDiscussionIds 是 API 认定含代码评论的讨论集合（某条 note 的 type='DiffNote' 且 position 非空）。
 * 「这条是不是代码评审」由数据判定而不是由 DOM 结构猜，MR 概览区的普通讨论因此天然不会挂上入口。
 * 省略该参数则给所有讨论容器挂上——取讨论失败时用它兜底，让用户点开能看到失败原因。
 */
export function attachEntries({ root, codeDiscussionIds, onOpen }) {
  function attachTo(box) {
    const { discussionId } = box.dataset;
    if (codeDiscussionIds && !codeDiscussionIds.has(discussionId)) return;
    if (box.querySelector(`.${ENTRY_CLASS}`)) return;

    const actions = box.querySelector(ACTIONS_SELECTOR);
    const entry = createEntry(discussionId, onOpen);
    // 放在「显示主题」左边，读者的视线正好落在这里
    if (actions) actions.prepend(entry);
    else box.prepend(entry);
  }

  function scan() {
    for (const box of root.querySelectorAll(DISCUSSION_SELECTOR)) attachTo(box);
  }

  scan();

  // 讨论区异步补渲染，展开/折叠主题时也会新增节点
  const observer = new MutationObserver(scan);
  observer.observe(root, { childList: true, subtree: true });

  return () => observer.disconnect();
}

const readCss = () => fetch(chrome.runtime.getURL("ui/drawer.css")).then((response) => response.text());

export async function init({
  origin = window.location.origin,
  location = window.location,
  root = document.body,
  fetchImpl = (...args) => window.fetch(...args),
  loadStyleText = readCss,
  // 令牌只在宿主页登录态被拒时才用得上（TD-2），存在设置里
  readToken = async () => (await ask(MESSAGE_ACTION.readSettings)).token,
  readSettings = () => ask(MESSAGE_ACTION.readSettings),
  writeSettings = (patch) => ask(MESSAGE_ACTION.writeSettings, { patch }),
  saveCard = (card) => ask(MESSAGE_ACTION.saveCard, { card }),
  reportActive = () => ask(MESSAGE_ACTION.pageActive),
  findCard = (source) => ask(MESSAGE_ACTION.findCard, { source }),
} = {}) {
  const ref = parseMergeRequestRef(location);
  if (!ref) return () => {};

  const client = createGitLabClient({ origin, fetch: fetchImpl, readToken });

  let drawer = null;
  // 样式与抽屉都懒建：任何一步出错都不该连入口一起拖没了
  async function ensureDrawer() {
    if (!drawer) {
      const settings = await readSettings().catch(() => ({}));
      drawer = createDrawer({
        styleText: await loadStyleText(),
        // 评论里的截图是项目相对的 /uploads/ 路径，补全成绝对地址才取得到（DD-44）
        site: { origin: window.location.origin, projectPath: ref.projectPath },
        // 展开/折叠要重新取数：片段与完整方法体是同一文件的不同截取
        // 只有一个单调变量：上下各多看多少行
        onWiden: (extraLines) => open({ discussionId: openedDiscussionId, extraLines }),
        readView: () => settings.view ?? null,
        writeView: (nextView) => writeSettings({ view: nextView }),
        onSaveCard: (card) => saveCard({ ...card, source: { ...card.source, ...ref, mrIid: Number(ref.mrIid) } }),
      });
    }
    return drawer;
  }

  // 取讨论失败时仍然挂入口：让用户点开看到失败原因，而不是面对一个什么都没有的页面
  let threadsByDiscussion = new Map();
  let mergeRequest = null;
  let loadError = null;
  try {
    // client 按 path 缓存，与 loadThreads 内部那次取 MR 只发一轮请求
    mergeRequest = await loadMergeRequest(client, ref);
    const threads = await loadThreads(client, ref);
    for (const thread of threads) {
      // 一个主题可能有多条评论，取第一条带 position 的即可定位代码
      if (!threadsByDiscussion.has(thread.discussionId)) {
        threadsByDiscussion.set(thread.discussionId, thread);
      }
    }
  } catch (error) {
    loadError = error;
  }

  let openedDiscussionId = null;

  async function open({ discussionId, extraLines = 0 }) {
    openedDiscussionId = discussionId;
    const view = await ensureDrawer();

    if (loadError) {
      view.render({ status: "failed", error: loadError, onRetry: () => open({ discussionId }) });
      return;
    }

    const thread = threadsByDiscussion.get(discussionId);
    if (!thread) return;

    view.render({ status: "loading", thread });
    try {
      const pair = await buildComparePair(client, {
        project: ref.project,
        thread,
        mrHeadSha: mergeRequest.diff_refs.head_sha,
        targetBranch: mergeRequest.target_branch,
        extraLines,
      });
      const saved = await findCard({
        origin: window.location.origin,
        project: ref.project,
        mrIid: Number(ref.mrIid),
        discussionId,
      }).catch(() => null);
      view.render({ status: "ready", thread, ...pair, extraLines, savedCardId: saved?.id ?? null });
    } catch (error) {
      view.render({ status: "failed", thread, error, onRetry: () => open({ discussionId }) });
    }
  }

  const detach = attachEntries({
    root,
    codeDiscussionIds: loadError ? undefined : new Set(threadsByDiscussion.keys()),
    onOpen: open,
  });

  /*
   * 告诉后台「这一页插件真的挂上了」，工具栏图标才点亮（DD-33）。
   * 上报失败不该影响已经挂好的入口，所以只吞这一处的错。
   */
  reportActive().catch(() => {});

  return () => {
    detach();
    drawer?.close();
  };
}
