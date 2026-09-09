import { ERROR_KIND } from "../core/gitlab/client.js";
import { createDrawer } from "../ui/drawer.js";
import { DRAWER_STATUS } from "../ui/drawer/status.js";

import { runDetached } from "./run-detached.js";

/**
 * 抽屉与扩展存储之间的一层：懒建实例、把界面偏好接到设置存储、给卡片补上回到原处的链接。
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
    isAlive = () => true,
  } = request;

  const mrUrl = `${origin}/${ref.projectPath}/-/merge_requests/${ref.mrIid}`;

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

  const persist = (patch) =>
    runDetached("这项偏好没能保存", () => writeSettings(patch));

  let drawer = null;
  let building = null;
  let buildError = null;

  function ensure() {
    if (buildError) {
      return Promise.reject(buildError);
    }
    building ??= (async () => {
      try {
        let settings = {};
        try {
          settings = await readSettings();
        } catch {
          settings = {};
        }

        if (!isAlive()) {
          throw new Error("挂载已失效");
        }

        drawer = createDrawer({
          styleText: await loadStyleText(),
          site: { origin, projectPath: ref.projectPath },
          onWiden,
          readView: () => settings.view ?? null,
          writeView: (nextView) => persist({ view: nextView }),
          readWidth: () => settings.drawerWidthPx ?? null,
          writeWidth: (nextWidth) => persist({ drawerWidthPx: nextWidth }),
          readSyncScroll: () => settings.isSyncScroll ?? null,
          writeSyncScroll: (isEnabled) => persist({ isSyncScroll: isEnabled }),
          onSaveCard: (card) => saveCard(withLocation(card)),
        });
        return drawer;
      } catch (error) {
        buildError = error;
        building = null;
        throw error;
      }
    })();

    return building;
  }

  function renderBuildFailure(error) {
    if (!isAlive()) {
      return;
    }
    if (!drawer) {
      drawer = createDrawer({ styleText: "", site: { origin, projectPath: ref.projectPath } });
    }
    drawer.render({
      status: DRAWER_STATUS.failed,
      error: {
        kind: ERROR_KIND.unexpected,
        status: 0,
        message: error?.message ?? "抽屉没能打开",
      },
    });
  }

  return {
    ensure,
    render: (state) => {
      if (!isAlive()) {
        return;
      }
      if (drawer) {
        drawer.render(state);
        return;
      }
      void building
        ?.then((instance) => {
          if (isAlive()) {
            instance.render(state);
          }
        })
        .catch(renderBuildFailure);
    },
    close: () => drawer?.close(),
  };
}
