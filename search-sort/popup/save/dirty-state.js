import { normalizeParams } from "../params/normalize.js";
import { HIDDEN_CLASS, POPUP_STATE } from "../ui-state.js";

function isSameConfig(current, baseline) {
  if (current.isEnabled !== baseline.isEnabled) {
    return false;
  }

  const { params: currentParams } = current;
  const { params: baselineParams } = baseline;
  if (currentParams.length !== baselineParams.length) {
    return false;
  }
  return currentParams.every(
    (param, index) =>
      param.key === baselineParams[index].key &&
      param.defaultValue === baselineParams[index].defaultValue,
  );
}

/** 跟踪相对 baseline 的未保存状态，驱动保存按钮样式与提示 */
export function createDirtyState(deps) {
  const { toggleEl, saveBtn, saveHint, popupEl, store } = deps;

  // 配置还没读出来，此时拿任何基准比出的脏态都是错的
  let baseline = null;

  function getCurrentConfig() {
    return {
      isEnabled: toggleEl.checked,
      params: normalizeParams(store.list()),
    };
  }

  function syncDirtyState() {
    if (baseline === null || popupEl.dataset.state === POPUP_STATE.blocked) {
      return;
    }
    const isDirty = !isSameConfig(getCurrentConfig(), baseline);
    saveBtn.classList.toggle("dirty", isDirty);
    saveHint.classList.toggle(HIDDEN_CLASS, !isDirty);
  }

  return {
    syncDirtyState,

    /** 传入已存配置就以它为基准，不传则以当前界面为基准 */
    setBaseline(savedConfig) {
      baseline = savedConfig
        ? {
            isEnabled: savedConfig.isEnabled,
            params: normalizeParams(savedConfig.params),
          }
        : getCurrentConfig();
      syncDirtyState();
    },
  };
}
