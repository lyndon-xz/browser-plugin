import { isPathPatternSupportedByRules } from "../../utils/default-param-rules.js";
import { MESSAGE_ACTION } from "../../utils/messages.js";
import {
  PATH_PATTERN_ERROR,
  isConfigActiveForURL,
  validatePathPattern,
} from "../../utils/path-rule.js";
import { StorageHelper } from "../../utils/storage.js";
import { applyURLToTab } from "../../utils/tab.js";
import { PARAM_MODE, buildURLWithParamRules } from "../../utils/url.js";

const SAVE_BTN_LABEL = "保存并应用";
const SAVE_FEEDBACK_MS = 1500;
const SUCCESS_CLASS = "success";
const FAILED_CLASS = "failed";

// 路径正则要两个消费方都用得上：结构上编译得出来，DNR 那边也得收
async function findPathPatternError(pathPattern) {
  const { isValid, reason } = validatePathPattern(pathPattern);
  if (!isValid) {
    return reason;
  }

  if (!(await isPathPatternSupportedByRules(pathPattern))) {
    return PATH_PATTERN_ERROR.unsupportedByRules;
  }
  return null;
}

/** 保存配置、应用到当前标签页，并反馈保存结果 */
export function createSaveConfig(deps) {
  const {
    saveBtn,
    store,
    readDraft,
    refreshCurrentTab,
    getRootDomain,
    renderParams,
    setBaseline,
    onInvalidPathPattern,
  } = deps;

  let feedbackTimer = null;
  let isSaving = false;

  function showSaveResult(text, isSuccess) {
    // 清掉上一轮的定时复位，否则它会把这一轮刚显示的结果提前抹掉
    clearTimeout(feedbackTimer);

    saveBtn.textContent = text;
    saveBtn.classList.toggle(SUCCESS_CLASS, isSuccess);
    saveBtn.classList.toggle(FAILED_CLASS, !isSuccess);

    feedbackTimer = setTimeout(() => {
      saveBtn.textContent = SAVE_BTN_LABEL;
      saveBtn.classList.remove(SUCCESS_CLASS);
      saveBtn.classList.remove(FAILED_CLASS);
    }, SAVE_FEEDBACK_MS);
  }

  /*
   * 默认值注入与剔除配置外参数只在这里发生：参数集一变必须整页导航，站点才读得到。
   * 不在作用范围内时不动 URL，免得把用户自己带的参数一起剔掉
   */
  async function persistAndApply(currentTab, config) {
    await StorageHelper.setConfig(getRootDomain(), config);

    const { id: tabId, url } = currentTab;
    const isActiveHere = isConfigActiveForURL(config, url);

    let appliedURL = url;
    let isApplied = true;
    if (isActiveHere) {
      appliedURL = buildURLWithParamRules(
        url,
        config.params,
        PARAM_MODE.configOnly,
      );
      ({ isApplied } = await applyURLToTab({
        tabId,
        oldURL: url,
        newURL: appliedURL,
      }));
    }

    // background 只刷新图标；URL 已应用时用 appliedURL，否则用当前页 URL 读配置
    const iconURL = isApplied ? appliedURL : (await refreshCurrentTab())?.url;
    if (iconURL) {
      await chrome.runtime.sendMessage({
        action: MESSAGE_ACTION.configUpdated,
        tabId,
        url: iconURL,
      });
    }

    return { isApplied, isActiveHere };
  }

  function onSaved(applyResult) {
    const { isApplied, isActiveHere } = applyResult;

    store.markAllSaved();
    renderParams();
    setBaseline();

    if (!isApplied) {
      showSaveResult("✓ 已保存（页面已跳转，请重开 popup）", true);
      return;
    }
    showSaveResult(isActiveHere ? "✓ 已应用" : "✓ 已保存", true);
  }

  async function saveConfig() {
    // 连点会走两遍「读整份 configs → 改一个域名 → 整份写回」，还可能发两次导航
    if (isSaving) {
      return;
    }
    isSaving = true;
    saveBtn.disabled = true;

    try {
      const currentTab = await refreshCurrentTab();
      if (!currentTab?.url) {
        showSaveResult("标签页已关闭", false);
        return;
      }

      const config = readDraft();
      const pathPatternError = await findPathPatternError(config.pathPattern);
      if (pathPatternError) {
        onInvalidPathPattern(pathPatternError);
        showSaveResult("路径正则无效", false);
        return;
      }

      onSaved(await persistAndApply(currentTab, config));
    } catch (e) {
      console.error("[search-sort] 保存配置失败：", e);
      showSaveResult("保存失败，请重试", false);
    } finally {
      isSaving = false;
      saveBtn.disabled = false;
    }
  }

  saveBtn.addEventListener("click", () => void saveConfig());
}
