import { HIDDEN_CLASS } from "../classes.js";

/** 对比/持久化用：去掉 UI 字段，defaultValue 归一 null */
export function normalizeParamsForCompare(paramList) {
  return paramList.map(({ key, defaultValue }) => ({
    key,
    defaultValue: defaultValue ?? null,
  }));
}

function isSameConfig(a, b) {
  if (a.isEnabled !== b.isEnabled) {
    return false;
  }
  if (a.params.length !== b.params.length) {
    return false;
  }
  return a.params.every(
    (param, index) =>
      param.key === b.params[index].key &&
      param.defaultValue === b.params[index].defaultValue,
  );
}

/** 跟踪相对 baseline 的未保存状态，驱动保存按钮样式与提示 */
export function createDirtyState(deps) {
  const { toggleEl, saveBtn, saveHint, popupEl, getParams } = deps;
  let baseline = { isEnabled: false, params: [] };

  function getCurrentConfig() {
    return {
      isEnabled: toggleEl.checked,
      params: normalizeParamsForCompare(getParams()),
    };
  }

  function syncDirtyState() {
    if (popupEl?.dataset.state === "blocked") {
      return;
    }
    const dirty = !isSameConfig(getCurrentConfig(), baseline);
    saveBtn.classList.toggle("dirty", dirty);
    saveHint.classList.toggle(HIDDEN_CLASS, !dirty);
  }

  function adoptBaseline() {
    baseline = getCurrentConfig();
    syncDirtyState();
  }

  function setBaselineFromSaved(savedConfig) {
    baseline = {
      isEnabled: savedConfig.isEnabled,
      params: normalizeParamsForCompare(savedConfig.params),
    };
  }

  function setBaselineFromCurrent() {
    baseline = getCurrentConfig();
  }

  return {
    syncDirtyState,
    adoptBaseline,
    setBaselineFromSaved,
    setBaselineFromCurrent,
  };
}
