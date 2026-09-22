// 弹窗：划词开关、练习场景选择、DeepSeek 密钥。
import {
  DEFAULT_SCENARIO_ID,
  PRACTICE_SCENARIOS,
  getScenario,
} from "../data/scenarios.js";
import {
  StorageHelper,
  STORAGE_KEYS,
  watchLocalStorage,
} from "../shared/utils/storage.js";

const powerEl = document.getElementById("status");
const statusText = document.getElementById("status-text");
const toggleInput = document.getElementById("toggle");
const input = document.getElementById("key");
const save = document.getElementById("save");
const well = document.getElementById("well");
const meta = document.getElementById("meta");
const scenarioPickerBtn = document.getElementById("scenario-picker-btn");
const scenarioPickerValue = document.getElementById("scenario-picker-value");
const scenarioPickerMenu = document.getElementById("scenario-picker-menu");

let enabled = false;
let statusHydrated = false;
let selectedScenarioId = DEFAULT_SCENARIO_ID;

function maskTail(key) {
  const tail = String(key).slice(-4);
  return "已保存在本机 · sk-••••" + tail;
}

function renderEnabled(next) {
  enabled = !!next;
  powerEl.classList.toggle("off", !enabled);
  powerEl.classList.remove("is-error");
  statusText.textContent = enabled ? "已启用" : "未启用";
  toggleInput.checked = enabled;

  if (!statusHydrated) {
    statusHydrated = true;
    toggleInput.disabled = false;
    requestAnimationFrame(() => {
      powerEl.classList.remove("is-loading");
    });
  }
}

function renderKey(key) {
  if (key) {
    well.classList.add("saved");
    meta.classList.add("ok");
    meta.textContent = maskTail(key);
  } else {
    well.classList.remove("saved");
    meta.classList.remove("ok");
    meta.textContent = "未配置 — 匹配不到时将无法 AI 推理";
  }
}

function renderScenarioPicker() {
  const scenario = getScenario(selectedScenarioId);
  scenarioPickerValue.textContent = scenario.label;
  scenarioPickerMenu.innerHTML = PRACTICE_SCENARIOS.map((item) => {
    const active = item.id === selectedScenarioId;
    return `<li role="option" data-id="${item.id}" class="${active ? "is-active" : ""}" aria-selected="${active}">${item.label}</li>`;
  }).join("");
}

function closeScenarioPicker() {
  scenarioPickerMenu.hidden = true;
  scenarioPickerBtn.setAttribute("aria-expanded", "false");
}

async function selectScenario(id) {
  selectedScenarioId = getScenario(id).id;
  renderScenarioPicker();
  closeScenarioPicker();
  await StorageHelper.setPracticeScenario(selectedScenarioId);
}

async function setEnabled(next) {
  toggleInput.disabled = true;
  try {
    await StorageHelper.setEnabled(next);
    renderEnabled(next);
  } catch (e) {
    console.error("[exam-helper] 切换启用状态失败：", e);
    powerEl.classList.add("is-error");
    statusText.textContent = "切换失败";
    toggleInput.checked = enabled;
  } finally {
    toggleInput.disabled = false;
  }
}

toggleInput.addEventListener("change", () => {
  void setEnabled(toggleInput.checked);
});

scenarioPickerBtn.addEventListener("click", () => {
  const nextOpen = scenarioPickerMenu.hidden;
  scenarioPickerMenu.hidden = !nextOpen;
  scenarioPickerBtn.setAttribute("aria-expanded", String(nextOpen));
});

scenarioPickerMenu.addEventListener("click", (event) => {
  const item = event.target.closest("[data-id]");
  if (!item) {
    return;
  }
  void selectScenario(item.dataset.id);
});

document.addEventListener("click", (event) => {
  if (
    scenarioPickerMenu.hidden ||
    event.target.closest("#scenario-picker")
  ) {
    return;
  }
  closeScenarioPicker();
});

document.getElementById("open-practice").addEventListener("click", () => {
  const scenario = getScenario(selectedScenarioId);
  const url = new URL(chrome.runtime.getURL(scenario.practicePage));
  url.searchParams.set("scenario", scenario.id);
  void chrome.tabs.create({ url: url.toString() });
});

document.getElementById("open-fixture").addEventListener("click", () => {
  void chrome.tabs.create({
    url: chrome.runtime.getURL("fixtures/acceptance.html"),
  });
});

input.addEventListener("input", () => {
  save.disabled = input.value.trim().length === 0;
});

save.addEventListener("click", () => {
  const value = input.value.trim();
  if (!value) return;
  StorageHelper.setApiKey(value)
    .then(() => {
      input.value = "";
      save.disabled = true;
      renderKey(value);
    })
    .catch((e) => {
      console.error("[exam-helper] 保存密钥失败：", e);
      meta.classList.remove("ok");
      meta.textContent = "保存失败，请重试";
    });
});

async function load() {
  try {
    const [nextEnabled, key, scenarioId] = await Promise.all([
      StorageHelper.getEnabled(),
      StorageHelper.getApiKey(),
      StorageHelper.getPracticeScenario(DEFAULT_SCENARIO_ID),
    ]);
    selectedScenarioId = scenarioId;
    renderScenarioPicker();
    renderEnabled(nextEnabled);
    renderKey(key);
  } catch (e) {
    console.error("[exam-helper] popup 读取状态失败：", e);
    renderScenarioPicker();
    renderEnabled(false);
    renderKey("");
  }
}

try {
  watchLocalStorage((changes) => {
    if (changes[STORAGE_KEYS.enabled]) {
      renderEnabled(!!changes[STORAGE_KEYS.enabled].newValue);
    }
    if (changes[STORAGE_KEYS.apiKey]) {
      renderKey(changes[STORAGE_KEYS.apiKey].newValue || "");
    }
    if (changes[STORAGE_KEYS.practiceScenario]) {
      selectedScenarioId =
        changes[STORAGE_KEYS.practiceScenario].newValue ||
        DEFAULT_SCENARIO_ID;
      renderScenarioPicker();
    }
  });
} catch (e) {
  /* storage 监听不可用时忽略 */
}

void load();
