import { MESSAGE_ACTION, ask } from "../core/messages.js";

const tokenInput = document.getElementById("token");
const originInput = document.getElementById("origin");
const originList = document.getElementById("origins");
const status = document.getElementById("status");

let settings = await ask(MESSAGE_ACTION.readSettings);
tokenInput.value = settings.token ?? "";

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
      settings = await ask(MESSAGE_ACTION.writeSettings, {
        patch: { extraOrigins: settings.extraOrigins.filter((item) => item !== origin) },
      });
      drawOrigins();
    });

    item.append(label, remove);
    originList.append(item);
  }
}

drawOrigins();

// 令牌留空即回到「只用宿主页登录态」，不留下一个半废的值
document.getElementById("save").addEventListener("click", async () => {
  settings = await ask(MESSAGE_ACTION.writeSettings, { patch: { token: tokenInput.value || null } });
  status.textContent = "已保存";
});

originInput.addEventListener("change", async () => {
  const origin = originInput.value.trim().replace(/\/$/, "");
  // 只接受 origin 本身：带路径或缺协议的都会让 match 模式失效
  if (!/^https?:\/\/[^/]+$/.test(origin)) {
    status.textContent = "站点要形如 https://gitlab.example.com";
    return;
  }

  const { granted } = await ask(MESSAGE_ACTION.registerOrigin, { origin });
  if (!granted) {
    status.textContent = "浏览器未授权该站点";
    return;
  }

  settings = await ask(MESSAGE_ACTION.writeSettings, {
    patch: { extraOrigins: [...new Set([...settings.extraOrigins, origin])] },
  });
  originInput.value = "";
  status.textContent = "已添加";
  drawOrigins();
});
