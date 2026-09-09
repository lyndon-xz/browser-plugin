import { hostOf, uniqueHosts } from "../core/platform/origins.js";
import { MESSAGE_ACTION, ask } from "../core/platform/messages.js";
import {
  ORIGIN_PATTERN,
  patternFor,
  requestOriginAccess,
} from "../core/platform/register-origin.js";

const tokenInput = document.getElementById("token");
const tokenOrigin = document.getElementById("token-origin");
const originInput = document.getElementById("origin");
const originList = document.getElementById("origins");
const addButton = document.getElementById("add-origin");
const status = document.getElementById("status");

const say = (text) => {
  status.textContent = text;
};

let settings = null;

const BUILT_IN_ORIGINS = [
  ...new Set(
    chrome.runtime
      .getManifest()
      .content_scripts.flatMap((script) => script.matches)
      .map((pattern) => pattern.replace(/\/\*$/, "")),
  ),
];

// http / https 在 manifest 里各写一条，设置页按 hostname 聚合为一项
const BUILT_IN_HOSTS = uniqueHosts(BUILT_IN_ORIGINS);

function tokenHosts() {
  return uniqueHosts([...BUILT_IN_ORIGINS, ...settings.extraOrigins]);
}

function drawTokenOrigins() {
  const kept = tokenOrigin.value;
  tokenOrigin.replaceChildren();

  for (const host of tokenHosts()) {
    const option = document.createElement("option");
    option.value = host;
    option.textContent = host;
    tokenOrigin.append(option);
  }

  tokenOrigin.value =
    kept && [...tokenOrigin.options].some((option) => option.value === kept)
      ? kept
      : BUILT_IN_HOSTS[0];
  tokenInput.value = settings.tokens?.[tokenOrigin.value] ?? "";
}

function drawOrigins() {
  originList.replaceChildren();

  for (const origin of settings.extraOrigins) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = origin;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "mini-btn danger";
    remove.textContent = "移除";
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      try {
        const removed = await ask(MESSAGE_ACTION.unregisterOrigin, { origin });
        if (!removed.isOk) {
          remove.disabled = false;
          say(`移除失败：${removed.message}。这个站点仍然生效。`);
          return;
        }

        const tokens = { ...settings.tokens };
        delete tokens[hostOf(origin)];
        settings = await ask(MESSAGE_ACTION.writeSettings, {
          patch: {
            extraOrigins: settings.extraOrigins.filter((kept) => kept !== origin),
            tokens,
          },
        });
        drawOrigins();
        drawTokenOrigins();
      } catch (error) {
        remove.disabled = false;
        say(`移除失败：${error.message}`);
      }
    });

    item.append(label, remove);
    originList.append(item);
  }
}

document.getElementById("save").addEventListener("click", async () => {
  try {
    const tokens = { ...settings.tokens };
    const host = tokenOrigin.value;
    if (tokenInput.value) {
      tokens[host] = tokenInput.value;
    } else {
      delete tokens[host];
    }

    settings = await ask(MESSAGE_ACTION.writeSettings, {
      patch: { tokens, shouldReenterToken: false },
    });
    say(`已保存 ${host}`);
  } catch (error) {
    say(`保存失败：${error.message}`);
  }
});

async function addOrigin() {
  if (addButton.disabled || !settings) {
    return;
  }

  const origin = originInput.value.trim().replace(/\/$/, "");
  if (!ORIGIN_PATTERN.test(origin)) {
    say("站点要形如 https://gitlab.example.com");
    return;
  }
  const host = hostOf(origin);
  if (
    BUILT_IN_HOSTS.includes(host) ||
    settings.extraOrigins.some((item) => hostOf(item) === host)
  ) {
    say("这个站点已经加过了");
    return;
  }

  addButton.disabled = true;
  try {
    const isGranted = await requestOriginAccess(chrome, origin);
    if (!isGranted) {
      say("浏览器未授权该站点");
      return;
    }

    const registered = await ask(MESSAGE_ACTION.registerOrigin, { origin });
    if (!registered.isOk) {
      try {
        await chrome.permissions.remove({ origins: [patternFor(origin)] });
      } catch (error) {
        console.warn("[review-lens] 回收站点权限失败：", error);
      }
      say(`注册失败：${registered.message ?? registered.reason}`);
      return;
    }

    settings = await ask(MESSAGE_ACTION.writeSettings, {
      patch: { extraOrigins: [...settings.extraOrigins, origin] },
    });
    originInput.value = "";
    say("已添加");
    drawOrigins();
    drawTokenOrigins();
  } catch (error) {
    say(`添加失败：${error.message}`);
  } finally {
    addButton.disabled = false;
  }
}

tokenOrigin.addEventListener("change", () => {
  tokenInput.value = settings?.tokens?.[tokenOrigin.value] ?? "";
});

addButton.addEventListener("click", addOrigin);
originInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    void addOrigin();
  }
});

try {
  settings = await ask(MESSAGE_ACTION.readSettings);
  drawTokenOrigins();
  drawOrigins();
  if (settings.shouldReenterToken) {
    say("旧版令牌已停用（它没有指定属于哪个站点）。请选择站点后重新填写。");
  }
} catch (error) {
  settings = null;
  addButton.disabled = true;
  document.getElementById("save").disabled = true;
  say(`读不到设置：${error.message}。重新打开这个页面再试。`);
}
