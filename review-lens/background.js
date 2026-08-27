import { MESSAGE_ACTION } from "./core/platform/messages.js";
import {
  registerOriginScripts,
  unregisterOrigin,
} from "./core/platform/register-origin.js";
import { createStore } from "./core/platform/store.js";

/*
 * service worker 只做 content script 与 popup 做不到的事：读写扩展存储、开设置页、
 * 为用户新增的站点动态注册 content script。
 */
const store = createStore(chrome.storage.local);

const ACTIVE_ICONS = {
  16: "icons/active/icon-16.png",
  32: "icons/active/icon-32.png",
  48: "icons/active/icon-48.png",
  128: "icons/active/icon-128.png",
};

// 只改上报过的那个标签页；Chrome 在标签页导航时会自动清掉标签页级的图标设置
const setIconFor = (tabId, path) =>
  tabId === undefined
    ? Promise.resolve()
    : chrome.action.setIcon({ tabId, path });

const lightUp = (tabId) => setIconFor(tabId, ACTIVE_ICONS);
/*
 * 复位要显式指回灰色图标：setIcon 必须给出 path 或 imageData，传 null 会被拒。
 * 取清单里声明的 default_icon，灰色图标的路径只在清单里写一份。
 */
const dimDown = (tabId) =>
  setIconFor(tabId, chrome.runtime.getManifest().action.default_icon);

const HANDLERS = {
  [MESSAGE_ACTION.listCards]: () => store.listCards(),
  [MESSAGE_ACTION.findCard]: (message) => store.findCard(message.source),
  [MESSAGE_ACTION.saveCard]: (message) => store.saveCard(message.card),
  [MESSAGE_ACTION.deleteCard]: (message) => store.deleteCard(message.id),
  [MESSAGE_ACTION.readSettings]: () => store.readSettings(),
  [MESSAGE_ACTION.writeSettings]: (message) =>
    store.writeSettings(message.patch),
  /*
   * 只注册脚本。授权由设置页在用户手势里同步发起：service worker 里没有手势，
   * chrome.permissions.request 在这里调会抛。
   */
  [MESSAGE_ACTION.registerOrigin]: (message) =>
    registerOriginScripts(chrome, message.origin),
  [MESSAGE_ACTION.unregisterOrigin]: (message) =>
    unregisterOrigin(chrome, message.origin),
  [MESSAGE_ACTION.openSettings]: () => chrome.runtime.openOptionsPage(),
  [MESSAGE_ACTION.pageActive]: (_message, sender) => lightUp(sender?.tab?.id),
  [MESSAGE_ACTION.pageInactive]: (_message, sender) => dimDown(sender?.tab?.id),
};

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const handler = HANDLERS[message?.action];
  // 认不出来的 action 也要回话：return false 会让调用方一直等，最后拿到与真实原因不符的报错
  if (!handler) {
    respond({ ok: false, error: `未知的 action：${message?.action}` });
    return false;
  }

  // 失败要带回给调用方，让界面能说出「存储失败」，而不是静默丢掉
  void (async () => {
    try {
      respond({ ok: true, result: await handler(message, sender) });
    } catch (error) {
      respond({ ok: false, error: error.message });
    }
  })();

  // 监听器本身必须同步返回 true，表示稍后异步 respond
  return true;
});
