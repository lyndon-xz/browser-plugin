import { MESSAGE_ACTION } from "../../utils/messages.js";
import { StorageHelper } from "../../utils/storage.js";
import { applyURLToTab } from "../../utils/tab.js";
import { PARAM_MODE, buildURLWithParamRules } from "../../utils/url.js";

const SAVE_BTN_LABEL = "保存并应用";
const SAVE_FEEDBACK_MS = 1500;

/** 保存配置、应用到当前标签页，并反馈保存结果 */
export function createSaveConfig(deps) {
  const {
    saveBtn,
    toggleEl,
    getParams,
    refreshCurrentTab,
    getRootDomain,
    renderParams,
    adoptBaseline,
  } = deps;

  function showSaveResult(text, isSuccess) {
    saveBtn.textContent = text;
    saveBtn.classList.toggle("success", isSuccess);
    saveBtn.classList.toggle("failed", !isSuccess);

    setTimeout(() => {
      saveBtn.textContent = SAVE_BTN_LABEL;
      saveBtn.classList.remove("success");
      saveBtn.classList.remove("failed");
    }, SAVE_FEEDBACK_MS);
  }

  async function saveConfig() {
    const currentTab = await refreshCurrentTab();
    if (!currentTab?.url) {
      return;
    }
    const { id: tabId, url } = currentTab;
    const params = getParams();
    const { checked: isEnabled } = toggleEl;
    const config = {
      isEnabled,
      params: params.map((param) => {
        const { key, defaultValue } = param;
        return { key, defaultValue };
      }),
    };

    /*
     * 默认值注入与剔除配置外参数只在这里发生——参数集一变必须整页导航站点才读得到。
     * 关掉开关时不动 URL：分不清哪些参数是注入的，剔除会连用户自己带的一起删
     */
    let applyResult = { applied: true, reason: "untouched" };

    try {
      await StorageHelper.setConfig(getRootDomain(), config);

      let appliedURL = url;
      if (isEnabled) {
        appliedURL = buildURLWithParamRules(
          url,
          config.params,
          PARAM_MODE.configOnly,
        );
        applyResult = await applyURLToTab({
          tabId,
          oldURL: url,
          newURL: appliedURL,
        });
      }

      // background 只刷新图标；URL 已应用时用 appliedURL，否则用当前页 URL 读配置
      const iconURL = applyResult.applied
        ? appliedURL
        : (await refreshCurrentTab())?.url;
      if (iconURL) {
        await chrome.runtime.sendMessage({
          action: MESSAGE_ACTION.configUpdated,
          tabId,
          url: iconURL,
        });
      }
    } catch (e) {
      console.error("[search-sort] 保存配置失败：", e);
      showSaveResult("保存失败，请重试", false);
      return;
    }

    for (const param of params) {
      param.isNew = false;
    }
    renderParams();
    adoptBaseline();

    if (applyResult.applied) {
      showSaveResult(isEnabled ? "✓ 已应用" : "✓ 已保存", true);
      return;
    }

    showSaveResult("✓ 已保存（页面已跳转，请重开 popup）", true);
  }

  saveBtn.addEventListener("click", () => void saveConfig());

  return { saveConfig };
}
