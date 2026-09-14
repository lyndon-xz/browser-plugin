import { PAPER_SOURCE } from "../core/constants.js";
import { PracticeStorage } from "../core/storage.js";
import { refreshCoverageStats } from "./render-panels.js";

/** 同步组卷方式切换 UI 与本地偏好 */
export async function syncPaperSourceUi() {
  const source = await PracticeStorage.getPaperSource();
  document.querySelectorAll(".source-opt").forEach((btn) => {
    const active = btn.dataset.source === source;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
  await refreshCoverageStats(Promise.resolve(source));
}

export function bindPaperSourceToggle() {
  document.querySelectorAll(".source-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const source =
        btn.dataset.source === PAPER_SOURCE.preset
          ? PAPER_SOURCE.preset
          : PAPER_SOURCE.ai;
      void PracticeStorage.savePaperSource(source).then(() =>
        syncPaperSourceUi(),
      );
    });
  });
}
