(function () {
  "use strict";

  let currentTab = null;
  let rootDomain = "";
  // 参数项结构：{ key, defaultValue, isNew }
  let params = [];

  const paramsListEl = document.getElementById("paramsList");
  const emptyState = document.getElementById("emptyState");
  const addSection = document.getElementById("addSection");

  const dragSort = createDragSort((fromIndex, toIndex) => {
    const [moved] = params.splice(fromIndex, 1);
    params.splice(toIndex, 0, moved);
    renderParams();
  });

  function renderParams() {
    paramsListEl.innerHTML = "";

    if (params.length === 0) {
      emptyState.classList.remove("hidden");
      addSection.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");

    params.forEach((param, index) => {
      const { key: paramKey, defaultValue, isNew } = param;

      const item = document.createElement("div");
      item.className = "param-item";
      item.draggable = true;
      item.dataset.index = index;

      const handle = document.createElement("span");
      handle.className = "drag-handle";
      handle.textContent = "≡";

      const key = document.createElement("span");
      key.className = "param-key";
      key.textContent = paramKey;

      const value = document.createElement("span");
      if (defaultValue == null) {
        value.className = "param-value empty";
        value.textContent = "—";
      } else {
        value.className = "param-value";
        value.textContent = defaultValue;
      }
      value.addEventListener("click", () => {
        startEditValue({
          item,
          initialValue: defaultValue,
          onCommit: (newValue) => {
            params[index].defaultValue = newValue;
            renderParams();
          },
        });
      });

      const deleteBtn = document.createElement("span");
      deleteBtn.className = "delete-btn";
      deleteBtn.textContent = "×";
      deleteBtn.addEventListener("click", () => {
        params.splice(index, 1);
        renderParams();
      });

      item.appendChild(handle);
      item.appendChild(key);
      item.appendChild(value);
      item.appendChild(deleteBtn);

      if (isNew) {
        const badge = document.createElement("span");
        badge.className = "new-badge";
        badge.textContent = "新";
        item.appendChild(badge);
      }

      dragSort.bindItem(item);
      paramsListEl.appendChild(item);
    });
  }

  const addBtn = document.getElementById("addBtn");
  const addForm = document.getElementById("addForm");
  const addKey = document.getElementById("addKey");
  const addValue = document.getElementById("addValue");
  const addConfirm = document.getElementById("addConfirm");
  const addCancel = document.getElementById("addCancel");
  // 参数名重复时红框停留的时长
  const KEY_ERROR_HINT_MS = 1000;

  addBtn.addEventListener("click", () => {
    addSection.classList.add("hidden");
    addForm.classList.remove("hidden");
    addKey.value = "";
    addValue.value = "";
    addKey.focus();
  });

  addCancel.addEventListener("click", () => {
    addForm.classList.add("hidden");
    addSection.classList.remove("hidden");
  });

  addConfirm.addEventListener("click", () => {
    const key = addKey.value.trim();
    if (!key) {
      addKey.focus();
      return;
    }

    if (params.some((param) => param.key === key)) {
      addKey.classList.add("error");
      setTimeout(() => {
        addKey.classList.remove("error");
      }, KEY_ERROR_HINT_MS);
      return;
    }

    const value = addValue.value.trim();
    params.unshift({
      key,
      defaultValue: value === "" ? null : value,
      isNew: true,
    });

    addForm.classList.add("hidden");
    addSection.classList.remove("hidden");
    renderParams();
  });

  addKey.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addValue.focus();
    }
    if (e.key === "Escape") addCancel.click();
  });

  addValue.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addConfirm.click();
    }
    if (e.key === "Escape") addCancel.click();
  });

  const toggleEl = document.getElementById("toggle");
  const saveBtn = document.getElementById("saveBtn");
  const SAVE_FEEDBACK_MS = 1500;

  function showSaveResult(text, isSuccess) {
    saveBtn.textContent = text;
    saveBtn.classList.toggle("success", isSuccess);
    saveBtn.classList.toggle("failed", !isSuccess);

    setTimeout(() => {
      saveBtn.textContent = "保存并应用";
      saveBtn.classList.remove("success");
      saveBtn.classList.remove("failed");
    }, SAVE_FEEDBACK_MS);
  }

  async function saveConfig() {
    const { id: tabId, url } = currentTab;
    const config = {
      enabled: toggleEl.checked,
      params: params.map((param) => ({
        key: param.key,
        defaultValue: param.defaultValue,
      })),
    };

    try {
      await StorageHelper.setConfig(rootDomain, config);

      let appliedURL = url;
      if (config.enabled) {
        appliedURL = buildURLWithParamRules(
          url,
          config.params,
          PARAM_MODE.configOnly,
        );
        await applyURLToTab({ tabId, oldURL: url, newURL: appliedURL });
      }

      // background 据此只刷新图标；带上应用后的 URL，它就不必自己重算
      await chrome.runtime.sendMessage({
        action: MESSAGE_ACTION.configUpdated,
        tabId,
        url: appliedURL,
      });
    } catch (e) {
      console.error("saveConfig failed:", e);
      showSaveResult("保存失败，请重试", false);
      return;
    }

    params = params.map((param) => ({ ...param, isNew: false }));
    renderParams();
    showSaveResult(config.enabled ? "✓ 已应用" : "✓ 已保存", true);
  }

  saveBtn.addEventListener("click", () => void saveConfig());

  // Switch 只是 UI 状态，随保存按钮一起写入 storage，不单独触发任何动作
  toggleEl.addEventListener("change", () => {
    saveBtn.textContent = "保存并应用 •";
  });

  const domainEl = document.getElementById("domain");

  async function init() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      currentTab = tab;

      const { url } = tab;
      if (!url || !url.startsWith("http")) {
        domainEl.textContent = "不支持此页面";
        toggleEl.disabled = true;
        saveBtn.disabled = true;
        addSection.classList.add("hidden");
        return;
      }

      const pageURL = new URL(url);
      rootDomain = extractRootDomain(pageURL.hostname);
      domainEl.textContent = rootDomain;

      const savedConfig = await StorageHelper.getConfig(rootDomain);
      if (savedConfig) {
        toggleEl.checked = savedConfig.enabled;
        params = savedConfig.params.map((param) => ({
          ...param,
          isNew: false,
        }));
      }

      /*
       * 已保存过配置的域名才给 URL 上多出来的参数打「新」标，
       * 让用户看出哪些是这次才冒出来、还没纳入配置的
       */
      for (const [key] of pageURL.searchParams) {
        if (!params.some((param) => param.key === key)) {
          params.push({ key, defaultValue: null, isNew: Boolean(savedConfig) });
        }
      }

      renderParams();
    } catch (e) {
      console.error("popup init failed:", e);
      domainEl.textContent = "读取配置失败";
      saveBtn.disabled = true;
    }
  }

  void init();
})();
