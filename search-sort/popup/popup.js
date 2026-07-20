(function () {
  "use strict";

  const KEY_ERROR_HINT_MS = 1000;
  const SAVE_FEEDBACK_MS = 1500;

  const domainEl = document.getElementById("domain");
  const toggleEl = document.getElementById("toggle");
  const paramsListEl = document.getElementById("paramsList");
  const addSection = document.getElementById("addSection");
  const addBtn = document.getElementById("addBtn");
  const addForm = document.getElementById("addForm");
  const addKey = document.getElementById("addKey");
  const addValue = document.getElementById("addValue");
  const addConfirm = document.getElementById("addConfirm");
  const addCancel = document.getElementById("addCancel");
  const saveBtn = document.getElementById("saveBtn");
  const emptyState = document.getElementById("emptyState");

  let currentTab = null;
  let rootDomain = "";
  // 参数项结构：{ key, defaultValue, isNew }
  let params = [];
  let savedConfig = null;

  async function init() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    currentTab = tab;

    if (!tab.url || !tab.url.startsWith("http")) {
      domainEl.textContent = "不支持此页面";
      return;
    }

    const url = new URL(tab.url);
    rootDomain = extractRootDomain(url.hostname);
    domainEl.textContent = rootDomain;

    savedConfig = await StorageHelper.getConfig(rootDomain);

    if (savedConfig) {
      toggleEl.checked = savedConfig.enabled;
      params = savedConfig.params.map((p) => ({ ...p, isNew: false }));
    } else {
      toggleEl.checked = false;
    }

    // Append URL params not in config
    const currentParams = new URLSearchParams(url.search);
    for (const [key] of currentParams) {
      if (!params.some((p) => p.key === key)) {
        params.push({ key, defaultValue: null, isNew: !!savedConfig });
      }
    }

    renderParams();
  }

  function renderParams() {
    paramsListEl.innerHTML = "";

    if (params.length === 0) {
      emptyState.classList.remove("hidden");
      addSection.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");

    params.forEach((param, index) => {
      const item = document.createElement("div");
      item.className = "param-item";
      item.draggable = true;
      item.dataset.index = index;

      const handle = document.createElement("span");
      handle.className = "drag-handle";
      handle.textContent = "≡";

      const key = document.createElement("span");
      key.className = "param-key";
      key.textContent = param.key;

      const value = document.createElement("span");
      if (param.defaultValue !== null && param.defaultValue !== undefined) {
        value.className = "param-value";
        value.textContent = param.defaultValue;
      } else {
        value.className = "param-value empty";
        value.textContent = "—";
      }
      value.addEventListener("click", () => startEditValue(item, param, index));

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

      if (param.isNew) {
        const badge = document.createElement("span");
        badge.className = "new-badge";
        badge.textContent = "新";
        item.appendChild(badge);
      }

      // Drag events
      item.addEventListener("dragstart", onDragStart);
      item.addEventListener("dragover", onDragOver);
      item.addEventListener("dragleave", onDragLeave);
      item.addEventListener("drop", onDrop);
      item.addEventListener("dragend", onDragEnd);

      paramsListEl.appendChild(item);
    });
  }

  // -- Drag and Drop --
  let dragIndex = null;

  function onDragStart(e) {
    dragIndex = parseInt(e.currentTarget.dataset.index);
    e.currentTarget.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const item = e.currentTarget;
    item.classList.add("drag-over");
  }

  function onDragLeave(e) {
    e.currentTarget.classList.remove("drag-over");
  }

  function onDrop(e) {
    e.preventDefault();
    const dropIndex = parseInt(e.currentTarget.dataset.index);
    e.currentTarget.classList.remove("drag-over");

    if (dragIndex !== null && dragIndex !== dropIndex) {
      const [moved] = params.splice(dragIndex, 1);
      params.splice(dropIndex, 0, moved);
      renderParams();
    }
  }

  function onDragEnd(e) {
    e.currentTarget.classList.remove("dragging");
    document
      .querySelectorAll(".drag-over")
      .forEach((el) => el.classList.remove("drag-over"));
  }

  // -- Edit Default Value --
  function startEditValue(item, param, index) {
    const existingInput = item.querySelector(".param-value-input");
    if (existingInput) return;

    const valueEl = item.querySelector(".param-value");
    valueEl.classList.add("hidden");

    const input = document.createElement("input");
    input.className = "param-value-input";
    input.value = param.defaultValue ?? "";
    input.placeholder = "默认值";

    item.insertBefore(input, item.querySelector(".delete-btn"));
    input.focus();
    input.select();

    let isClosed = false;

    // save=true 时写回默认值并重渲染；解绑 blur 并用 isClosed 守卫，
    // 避免 input.remove() 触发 blur 后重复执行（NotFoundError 根因）
    function close(save) {
      if (isClosed) return;
      isClosed = true;
      input.removeEventListener("blur", onBlur);

      if (save) {
        const val = input.value.trim();
        params[index].defaultValue = val === "" ? null : val;
      }

      input.remove();
      valueEl.classList.remove("hidden");

      if (save) renderParams();
    }

    function onBlur() {
      close(true);
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") close(true);
      if (e.key === "Escape") close(false);
    });

    input.addEventListener("blur", onBlur);
  }

  // -- Add Param --
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

    if (params.some((p) => p.key === key)) {
      addKey.style.borderColor = "#E74C3C";
      setTimeout(() => {
        addKey.style.borderColor = "";
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

  // -- Save --
  saveBtn.addEventListener("click", async () => {
    const config = {
      enabled: toggleEl.checked,
      params: params.map((p) => ({ key: p.key, defaultValue: p.defaultValue })),
    };

    await StorageHelper.setConfig(rootDomain, config);

    if (config.enabled) {
      // strict=true：保存时以配置为准，剔除配置外的参数
      const finalHref = buildSortedURL(currentTab.url, config.params, true);
      await applyURLToTab({
        tabId: currentTab.id,
        oldURL: currentTab.url,
        newURL: finalHref,
        config,
      });
    }

    // Notify background to update icon
    chrome.runtime.sendMessage({
      action: "configUpdated",
      tabId: currentTab.id,
      url: currentTab.url,
    });

    // Clear "new" badges
    params = params.map((p) => ({ ...p, isNew: false }));

    // Success feedback
    saveBtn.textContent = config.enabled ? "✓ 已应用" : "✓ 已保存";
    saveBtn.classList.add("success");
    setTimeout(() => {
      saveBtn.textContent = "保存并应用";
      saveBtn.classList.remove("success");
    }, SAVE_FEEDBACK_MS);

    renderParams();
  });

  // -- Toggle --
  // Switch 只是 UI 状态，随保存按钮一起写入 storage，不单独触发任何动作
  toggleEl.addEventListener("change", () => {
    saveBtn.textContent = "保存并应用 •";
  });

  init();
})();
