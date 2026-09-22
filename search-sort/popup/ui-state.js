/** popup 的显隐 class，JS 与 popup.css 共用同一个字面量 */
export const HIDDEN_CLASS = "hidden";

/** #popup 的 data-state，两种都会让配置区不可操作；popup.css 有同名选择器 */
export const POPUP_STATE = {
  // 配置还没从 storage 读出来
  loading: "loading",
  // 当前页不支持配置，或配置读取失败
  blocked: "blocked",
};

/** 路径提示的 data-state，popup.css 按这些值给不同颜色 */
export const PATH_HINT_STATE = {
  neutral: "neutral",
  matched: "matched",
  unmatched: "unmatched",
  invalid: "invalid",
};
