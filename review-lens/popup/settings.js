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

// https 是常态，前缀不承载信息就去掉；http 留着，同一主机的两条才区分得开，也看得出不加密
const displayName = (origin) => origin.replace(/^https:\/\//, "");

let settings = null;

/*
 * 内置站点取自清单里 content script 的注入范围：两处各写一份就会漂移——插件在某个站点上
 * 挂得出入口，设置页却列不出它，用户没法给它配令牌。
 */
const BUILT_IN_ORIGINS = [
  ...new Set(
    chrome.runtime
      .getManifest()
      .content_scripts.flatMap((script) => script.matches)
      .map((pattern) => pattern.replace(/\/\*$/, "")),
  ),
];

function drawTokenOrigins() {
  const kept = tokenOrigin.value;
  tokenOrigin.replaceChildren();

  for (const origin of [...BUILT_IN_ORIGINS, ...settings.extraOrigins]) {
    const option = document.createElement("option");
    option.value = origin;
    option.textContent = displayName(origin);
    tokenOrigin.append(option);
  }

  tokenOrigin.value =
    kept && [...tokenOrigin.options].some((o) => o.value === kept)
      ? kept
      : BUILT_IN_ORIGINS[0];
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
        // 先停掉注入与授权，再从列表划掉：只改列表，站点实际仍然生效
        const removed = await ask(MESSAGE_ACTION.unregisterOrigin, { origin });
        if (!removed.ok) {
          remove.disabled = false;
          say(`移除失败：${removed.message}。这个站点仍然生效。`);
          return;
        }

        settings = await ask(MESSAGE_ACTION.writeSettings, {
          patch: {
            extraOrigins: settings.extraOrigins.filter(
              (kept) => kept !== origin,
            ),
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
    // 留空的意思是「这个站点回到用登录态」，那就把这一项去掉而不是留一个空串
    if (tokenInput.value) tokens[tokenOrigin.value] = tokenInput.value;
    else delete tokens[tokenOrigin.value];

    settings = await ask(MESSAGE_ACTION.writeSettings, { patch: { tokens } });
    say(`已保存 ${displayName(tokenOrigin.value)} 的设置`);
  } catch (error) {
    say(`保存失败：${error.message}`);
  }
});

/*
 * 授权要在用户手势的同步上下文里发起：permissions.request 之前不能有 await，
 * 否则手势过期后 Chrome 会抛；也因此它不能交给 service worker（那边没有手势）。
 */
async function addOrigin() {
  /*
   * 两条触发路径（点击、回车）：只在按钮上设 disabled 挡不住回车，
   * 连按两次会并发跑两遍授权与写入；settings 未就绪时读它的字段会抛。
   */
  if (addButton.disabled || !settings) return;

  const origin = originInput.value.trim().replace(/\/$/, "");
  if (!ORIGIN_PATTERN.test(origin)) {
    say("站点要形如 https://gitlab.example.com");
    return;
  }
  if (settings.extraOrigins.includes(origin)) {
    say("这个站点已经加过了");
    return;
  }

  addButton.disabled = true;
  try {
    const granted = await requestOriginAccess(chrome, origin);
    if (!granted) {
      say("浏览器未授权该站点");
      return;
    }

    const registered = await ask(MESSAGE_ACTION.registerOrigin, { origin });
    if (!registered.ok) {
      // 注册失败要说出来：权限拿到了但脚本没注册，页面上什么都不会出现
      try {
        await chrome.permissions.remove({ origins: [patternFor(origin)] });
      } catch {
        // 回收权限失败不改变要告诉用户的结论：脚本没注册上，这个站点不会生效
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

// 切站点就换成那个站点已存的令牌，上一个站点的值不留在框里被误存过去
tokenOrigin.addEventListener("change", () => {
  tokenInput.value = settings?.tokens?.[tokenOrigin.value] ?? "";
});

addButton.addEventListener("click", addOrigin);
originInput.addEventListener("keydown", (event) => {
  // addOrigin 自己 try/catch/finally 全包，失败已在界面上说明，这里刻意不等
  if (event.key === "Enter") void addOrigin();
});

// 读设置失败也得说话，否则整个模块中止、页面只剩一个空壳
try {
  settings = await ask(MESSAGE_ACTION.readSettings);
  drawTokenOrigins();
  drawOrigins();
  // 令牌按站点隔离，没有指定站点的旧令牌无法归属，要请用户重填一次
  if (settings.needsTokenReentry) {
    say("旧版令牌已停用（它没有指定属于哪个站点）。请选择站点后重新填写。");
  }
} catch (error) {
  /*
   * 降级状态不写回存储：空壳一旦允许「保存」，点一下就把用户已存的令牌清成 null。
   * settings 保持 null 作为「没读到」的唯一表示，两个写入口一并关掉。
   */
  settings = null;
  addButton.disabled = true;
  document.getElementById("save").disabled = true;
  say(`读不到设置：${error.message}。重新打开这个页面再试。`);
}
