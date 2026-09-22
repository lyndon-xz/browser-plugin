import {
  PATH_PATTERN_ERROR,
  matchesPathPattern,
  normalizePathPattern,
  validatePathPattern,
} from "../utils/path-rule.js";

import { flashInvalid } from "./flash-invalid.js";
import { PATH_HINT_STATE } from "./ui-state.js";

const INVALID_PATTERN_HINT_MS = 1000;

// 正则写完看不出对不对，就地拿当前页路径试一遍给结论，不用等保存被拦下才知道
const PATH_RULE_HINT = {
  anyPath: { text: "全部路径", state: PATH_HINT_STATE.neutral },
  matched: { text: "本页命中", state: PATH_HINT_STATE.matched },
  unmatched: { text: "本页不命中", state: PATH_HINT_STATE.unmatched },
};

const INVALID_HINT_TEXT = {
  [PATH_PATTERN_ERROR.syntax]: "正则有误",
  [PATH_PATTERN_ERROR.mustStartWithSlash]: "要以 / 开头",
  [PATH_PATTERN_ERROR.innerAnchor]: "^ $ 只能放两端",
  [PATH_PATTERN_ERROR.unsupportedByRules]: "Chrome 不支持",
};

/** 路径正则输入框：边打边拿当前页路径试，实时告诉用户命不命中 */
export function createPathRuleField(deps) {
  const { pathInput, pathHint, getPagePathname, onDirty } = deps;

  function showHint(hint) {
    pathHint.textContent = hint.text;
    pathHint.dataset.state = hint.state;
  }

  function showInvalidHint(reason) {
    showHint({
      text:
        INVALID_HINT_TEXT[reason] ??
        INVALID_HINT_TEXT[PATH_PATTERN_ERROR.syntax],
      state: PATH_HINT_STATE.invalid,
    });
  }

  function refreshHint() {
    const pattern = normalizePathPattern(pathInput.value);
    if (pattern === null) {
      showHint(PATH_RULE_HINT.anyPath);
      return;
    }

    const { isValid, reason } = validatePathPattern(pattern);
    if (!isValid) {
      showInvalidHint(reason);
      return;
    }

    showHint(
      matchesPathPattern(getPagePathname(), pattern)
        ? PATH_RULE_HINT.matched
        : PATH_RULE_HINT.unmatched,
    );
  }

  pathInput.addEventListener("input", () => {
    refreshHint();
    onDirty();
  });

  return {
    /** 回填已存配置并给出提示；传 null 表示不限路径。这是唯一的初始化入口 */
    setPattern(pattern) {
      pathInput.value = pattern ?? "";
      refreshHint();
    },

    /** 保存时被拦下：闪一下输入框，并就地说明错在哪 */
    markInvalid(reason) {
      flashInvalid(pathInput, INVALID_PATTERN_HINT_MS);
      showInvalidHint(reason);
    },
  };
}
