import { emptyDefaultToNull } from "../../utils/url.js";

/** 落盘与脏态对比共用的形态：只留 key 与 defaultValue，空值归一为 null */
export function normalizeParams(params) {
  return params.map((param) => {
    const { key, defaultValue } = param;
    return { key, defaultValue: emptyDefaultToNull(defaultValue) };
  });
}
