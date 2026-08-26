import { createDrawer } from "../ui/drawer.js";

import { runDetached } from "./run-detached.js";

/**
 * 抽屉与扩展存储之间的一层：懒建实例、把界面偏好接到设置存储、给卡片补上回到原处的链接。
 * 抽屉本身不认识 chrome.*，这些注入口都在这里配好。
 */
export function createDrawerBridge(request) {
  const {
    ref,
    origin,
    loadStyleText,
    readSettings,
    writeSettings,
    saveCard,
    onWiden,
  } = request;

  const mrUrl = `${origin}/${ref.projectPath}/-/merge_requests/${ref.mrIid}`;

  /*
   * 弹窗的「回到 MR」与导出的位置链接都读 source.webUrl；
   * project 是 encodeURIComponent 后的 API id，展示要用 projectPath。
   */
  const withLocation = (card) => ({
    ...card,
    source: {
      ...card.source,
      ...ref,
      mrIid: Number(ref.mrIid),
      webUrl: card.source.noteId
        ? `${mrUrl}#note_${card.source.noteId}`
        : mrUrl,
    },
  });

  // 偏好写不进去就记一笔、下次打开回到旧值，不为它打扰正在读评审的人
  const persist = (patch) =>
    runDetached("这项偏好没能保存", () => writeSettings(patch));

  let drawer = null;
  let building = null;

  /*
   * 缓存的是「建的过程」而不是「建好的实例」：drawer 赋值在两个 await 之后，
   * 连点会让两次调用都看到 drawer === null，于是往页面插两个宿主节点。
   */
  function ensure() {
    building ??= (async () => {
      let settings = {};
      try {
        settings = await readSettings();
      } catch {
        // 读不到界面偏好就用默认值开抽屉，不为一份偏好挡住读评审
        settings = {};
      }

      drawer = createDrawer({
        styleText: await loadStyleText(),
        // 评论里的截图是项目相对的 /uploads/ 路径，补全成绝对地址才取得到
        site: { origin, projectPath: ref.projectPath },
        onWiden,
        readView: () => settings.view ?? null,
        writeView: (nextView) => persist({ view: nextView }),
        readWidth: () => settings.drawerWidth ?? null,
        writeWidth: (nextWidth) => persist({ drawerWidth: nextWidth }),
        readSyncScroll: () => settings.syncScroll ?? null,
        writeSyncScroll: (on) => persist({ syncScroll: on }),
        onSaveCard: (card) => saveCard(withLocation(card)),
      });
      return drawer;
    })();

    return building;
  }

  return {
    ensure,
    render: (state) => drawer.render(state),
    close: () => drawer?.close(),
  };
}
