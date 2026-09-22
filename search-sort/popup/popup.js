import { extractRootDomain } from "../utils/domain.js";
import { isTabGoneError } from "../utils/runtime-error.js";
import { StorageHelper } from "../utils/storage.js";
import { isSupportedURL } from "../utils/url.js";

import { readConfigDraft } from "./config-draft.js";
import { bindAddParamForm } from "./params/add.js";
import { createParamsRenderer } from "./params/render.js";
import { createParamsStore } from "./params/store.js";
import { createPathRuleField } from "./path-rule-field.js";
import { createSaveConfig } from "./save/config.js";
import { createDirtyState } from "./save/dirty-state.js";
import { POPUP_STATE } from "./ui-state.js";

const popupEl = document.getElementById("popup");
const store = createParamsStore();

let currentTab = null;
let rootDomain = "";

async function refreshCurrentTab() {
  if (!currentTab?.id) {
    return null;
  }
  try {
    currentTab = await chrome.tabs.get(currentTab.id);
    return currentTab;
  } catch (e) {
    if (isTabGoneError(e)) {
      currentTab = null;
      return null;
    }
    throw e;
  }
}

const toggleEl = document.getElementById("toggle");
const pathInput = document.getElementById("pathPattern");
const saveBtn = document.getElementById("saveBtn");
const saveHint = document.getElementById("saveHint");

const readDraft = () => readConfigDraft({ toggleEl, pathInput, store });

const { syncDirtyState, setBaseline } = createDirtyState({
  saveBtn,
  saveHint,
  popupEl,
  readDraft,
});

// Switch 只是 UI 状态，随保存按钮一起写入 storage，不单独触发任何动作
toggleEl.addEventListener("change", syncDirtyState);

function getPagePathname() {
  const url = currentTab?.url;
  if (!url) {
    return "/";
  }
  try {
    return new URL(url).pathname;
  } catch {
    return "/";
  }
}

const pathRuleField = createPathRuleField({
  pathInput,
  pathHint: document.getElementById("pathPatternHint"),
  getPagePathname,
  onDirty: syncDirtyState,
});

const paramsListEl = document.getElementById("paramsList");
const stateBox = document.getElementById("stateBox");
const stateTitle = document.getElementById("stateTitle");
const stateDesc = document.getElementById("stateDesc");

const { renderParams, showState } = createParamsRenderer({
  store,
  elements: { paramsListEl, stateBox, stateTitle, stateDesc },
  onDirty: syncDirtyState,
});

const addBtn = document.getElementById("addBtn");
const addSection = document.getElementById("addSection");
const addForm = document.getElementById("addForm");
const addKey = document.getElementById("addKey");
const addValue = document.getElementById("addValue");
const addConfirm = document.getElementById("addConfirm");
const addCancel = document.getElementById("addCancel");

bindAddParamForm({
  store,
  elements: {
    addBtn,
    addSection,
    addForm,
    addKey,
    addValue,
    addConfirm,
    addCancel,
  },
  renderParams,
  onDirty: syncDirtyState,
});

createSaveConfig({
  saveBtn,
  store,
  readDraft,
  refreshCurrentTab,
  getRootDomain: () => rootDomain,
  renderParams,
  setBaseline,
  onInvalidPathPattern: pathRuleField.markInvalid,
});

function blockConfiguring(stateText) {
  popupEl.dataset.state = POPUP_STATE.blocked;
  showState(stateText);
}

const domainEl = document.getElementById("domain");

async function init() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    currentTab = tab;

    const { url } = tab;
    if (!isSupportedURL(url)) {
      blockConfiguring({
        title: "不支持这个页面",
        desc: "只能在 http(s) 页面上排序查询参数",
      });
      return;
    }

    const { hostname, searchParams } = new URL(url);
    rootDomain = extractRootDomain(hostname);
    domainEl.textContent = rootDomain;

    const savedConfig = await StorageHelper.getConfig(rootDomain);
    // 没存过配置时也要走一遍：它负责把提示区从空白刷成「全部路径」
    pathRuleField.setPattern(savedConfig?.pathPattern ?? null);

    if (savedConfig) {
      toggleEl.checked = savedConfig.isEnabled;
      store.replaceAll(savedConfig.params);
      setBaseline(savedConfig);
    }

    // URL 上有、配置里没有的参数补进列表；已存过配置时标「新」提示是这次多出来的
    store.appendMissingKeys([...searchParams.keys()], {
      isNew: Boolean(savedConfig),
    });

    if (!savedConfig) {
      setBaseline();
    }

    renderParams();
    syncDirtyState();
  } catch (e) {
    console.error("[search-sort] popup 初始化失败：", e);
    blockConfiguring({
      title: "读取配置失败",
      desc: "关掉弹窗重新打开试试",
    });
  }
}

/*
 * popup.html 上预置了 data-state="loading"：配置读出来之前整个配置区不可操作，
 * 否则这段窗口里的改动会被恢复出来的配置整体覆盖掉
 */
await init();

if (popupEl.dataset.state === POPUP_STATE.loading) {
  /*
   * 先强制算一次样式，让 init 里那次「开关置为已启用」在 loading 态（过渡被关掉）
   * 落定。不这么做的话，它和下面解除 loading 会合进同一帧：过渡刚好在那一刻被
   * 重新打开，滑块就从灰滑到绿——这正是打开 popup 时看到的那下闪动
   */
  void popupEl.offsetHeight;

  delete popupEl.dataset.state;
  saveBtn.disabled = false;
}
