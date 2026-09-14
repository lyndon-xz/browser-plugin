import { extractRootDomain } from "../utils/domain.js";
import { StorageHelper } from "../utils/storage.js";
import { isSupportedURL } from "../utils/url.js";

import { bindAddParamForm } from "./params/add-param.js";
import { createParamsRenderer } from "./params/render-params.js";
import { createDirtyState } from "./save/dirty-state.js";
import { createSaveConfig } from "./save/save-config.js";

// 参数项结构：{ key, defaultValue, isNew }
const params = [];

const paramsListEl = document.getElementById("paramsList");
const addSection = document.getElementById("addSection");
const stateBox = document.getElementById("stateBox");
const stateTitle = document.getElementById("stateTitle");
const stateDesc = document.getElementById("stateDesc");
const addForm = document.getElementById("addForm");
const addKey = document.getElementById("addKey");
const addValue = document.getElementById("addValue");
const addConfirm = document.getElementById("addConfirm");
const addCancel = document.getElementById("addCancel");
const toggleEl = document.getElementById("toggle");
const saveBtn = document.getElementById("saveBtn");
const saveHint = document.getElementById("saveHint");
const popupEl = document.getElementById("popup");
const domainEl = document.getElementById("domain");

let currentTab = null;
let rootDomain = "";

const isTabGoneError = (error) =>
  /No tab with id/i.test(error?.message ?? String(error));

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

const dirtyState = createDirtyState({
  toggleEl,
  saveBtn,
  saveHint,
  popupEl,
  getParams: () => params,
});

const { renderParams, showState } = createParamsRenderer({
  params,
  elements: {
    paramsListEl,
    addSection,
    stateBox,
    stateTitle,
    stateDesc,
  },
  onDirty: dirtyState.syncDirtyState,
});

bindAddParamForm({
  params,
  elements: { addSection, addForm, addKey, addValue, addConfirm, addCancel },
  renderParams,
  onDirty: dirtyState.syncDirtyState,
});

createSaveConfig({
  saveBtn,
  toggleEl,
  getParams: () => params,
  refreshCurrentTab,
  getRootDomain: () => rootDomain,
  renderParams,
  adoptBaseline: dirtyState.adoptBaseline,
});

// Switch 只是 UI 状态，随保存按钮一起写入 storage，不单独触发任何动作
toggleEl.addEventListener("change", dirtyState.syncDirtyState);

function blockConfiguring(stateText) {
  popupEl.dataset.state = "blocked";
  showState(stateText);
}

function mergeCurrentUrlParams(searchParams, existing, hasSavedConfig) {
  const merged = [...existing];
  for (const [key] of searchParams) {
    if (!merged.some((param) => param.key === key)) {
      merged.push({
        key,
        defaultValue: null,
        isNew: Boolean(hasSavedConfig),
      });
    }
  }
  return merged;
}

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

    const pageURL = new URL(url);
    const { hostname, searchParams } = pageURL;
    rootDomain = extractRootDomain(hostname);
    domainEl.textContent = rootDomain;

    const savedConfig = await StorageHelper.getConfig(rootDomain);
    if (savedConfig) {
      const { isEnabled, params: savedParams } = savedConfig;
      toggleEl.checked = isEnabled;
      params.splice(
        0,
        params.length,
        ...savedParams.map((param) => ({ ...param, isNew: false })),
      );
      dirtyState.setBaselineFromSaved(savedConfig);
    }

    const merged = mergeCurrentUrlParams(searchParams, params, savedConfig);
    params.splice(0, params.length, ...merged);

    if (!savedConfig) {
      dirtyState.setBaselineFromCurrent();
    }

    renderParams();
    dirtyState.syncDirtyState();
  } catch (e) {
    console.error("[search-sort] popup 初始化失败：", e);
    blockConfiguring({
      title: "读取配置失败",
      desc: "关掉弹窗重新打开试试",
    });
  }
}

saveBtn.disabled = true;
void init().finally(() => {
  if (popupEl.dataset.state !== "blocked") {
    saveBtn.disabled = false;
  }
});
