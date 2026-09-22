import { normalizeParams } from "../params/normalize.js";
import { HIDDEN_CLASS, POPUP_STATE } from "../ui-state.js";

function isSameParams(currentParams, baselineParams) {
  if (currentParams.length !== baselineParams.length) {
    return false;
  }
  return currentParams.every((param, index) => {
    const { key, defaultValue } = baselineParams[index];
    return param.key === key && param.defaultValue === defaultValue;
  });
}

function isSameConfig(current, baseline) {
  const {
    isEnabled: currentIsEnabled,
    pathPattern: currentPathPattern,
    params: currentParams,
  } = current;
  const {
    isEnabled: baselineIsEnabled,
    pathPattern: baselinePathPattern,
    params: baselineParams,
  } = baseline;

  return (
    currentIsEnabled === baselineIsEnabled &&
    currentPathPattern === baselinePathPattern &&
    isSameParams(currentParams, baselineParams)
  );
}

/** 跟踪相对 baseline 的未保存状态，驱动保存按钮样式与提示 */
export function createDirtyState(deps) {
  const { saveBtn, saveHint, popupEl, readDraft } = deps;

  // 配置还没读出来，此时拿任何基准比出的脏态都是错的
  let baseline = null;

  function syncDirtyState() {
    if (baseline === null || popupEl.dataset.state === POPUP_STATE.blocked) {
      return;
    }
    const isDirty = !isSameConfig(readDraft(), baseline);
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
            pathPattern: savedConfig.pathPattern,
            params: normalizeParams(savedConfig.params),
          }
        : readDraft();
      syncDirtyState();
    },
  };
}
