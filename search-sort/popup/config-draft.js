import { normalizePathPattern } from "../utils/path-rule.js";

import { normalizeParams } from "./params/normalize.js";

/** 读界面上的当前配置。落盘与脏态对比共用这一份读法，免得两边口径漂开 */
export function readConfigDraft(sources) {
  const { toggleEl, pathInput, store } = sources;

  return {
    isEnabled: toggleEl.checked,
    pathPattern: normalizePathPattern(pathInput.value),
    params: normalizeParams(store.list()),
  };
}
