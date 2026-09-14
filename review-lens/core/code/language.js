/** 方法切片、Java 语法着色与按方法名定位目前只覆盖这类扩展名 */
const JAVA_LIKE = /\.(java|kt|kts)$/i;

/** 路径是否走 Java 系代码分析（方法体切片、语法着色） */
export function isJavaLikePath(path) {
  return JAVA_LIKE.test(String(path ?? ""));
}
