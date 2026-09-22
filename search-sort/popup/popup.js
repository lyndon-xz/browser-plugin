import { extractRootDomain } from "../utils/domain.js";
import { isTabGoneError } from "../utils/runtime-error.js";
import { StorageHelper } from "../utils/storage.js";
import { isSupportedURL } from "../utils/url.js";

import { bindAddParamForm } from "./params/add.js";
import { createParamsRenderer } from "./params/render.js";
import { createParamsStore } from "./params/store.js";
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
const saveBtn = document.getElementById("saveBtn");
const saveHint = document.getElementById("saveHint");

const { syncDirtyState, setBaseline } = createDirtyState({
  toggleEl,
  saveBtn,
  saveHint,
  popupEl,
  store,
});

// Switch 只是 UI 状态，随保存按钮一起写入 storage，不单独触发任何动作
toggleEl.addEventListener("change", syncDirtyState);

const paramsListEl = document.getElementById("paramsList");
const addSection = document.getElementById("addSection");
const stateBox = document.getElementById("stateBox");
const stateTitle = document.getElementById("stateTitle");
const stateDesc = document.getElementById("stateDesc");

const { renderParams, showState } = createParamsRenderer({
  store,
  elements: { paramsListEl, addSection, stateBox, stateTitle, stateDesc },
  onDirty: syncDirtyState,
});

const addBtn = document.getElementById("addBtn");
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
  toggleEl,
  store,
  refreshCurrentTab,
  getRootDomain: () => rootDomain,
  renderParams,
  setBaseline,
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
  delete popupEl.dataset.state;
  saveBtn.disabled = false;
}
