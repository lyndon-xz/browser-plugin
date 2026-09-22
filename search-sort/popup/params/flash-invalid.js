const ERROR_CLASS = "error";

/** 校验失败的瞬时提示：挂一下错误态再自动摘掉 */
export function flashInvalid(el, durationMs) {
  el.classList.add(ERROR_CLASS);
  setTimeout(() => {
    el.classList.remove(ERROR_CLASS);
  }, durationMs);
}
