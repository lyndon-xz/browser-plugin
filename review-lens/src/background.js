import { MESSAGE_ACTION } from "./core/messages.js";
import { registerOrigin, unregisterOrigin } from "./core/register-origin.js";
import { createStore } from "./core/store.js";

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

/*
 * 只点亮上报过的那个标签页。Chrome 在标签页导航时会自动清掉标签页级的图标设置，
 * 所以离开 MR 页就自动回到清单里声明的灰色，不需要自己复位。
 */
const lightUp = (tabId) =>
  tabId === undefined ? Promise.resolve() : chrome.action.setIcon({ tabId, path: ACTIVE_ICONS });

const HANDLERS = {
  [MESSAGE_ACTION.listCards]: () => store.listCards(),
  [MESSAGE_ACTION.findCard]: ({ source }) => store.findCard(source),
  [MESSAGE_ACTION.saveCard]: ({ card }) => store.saveCard(card),
  [MESSAGE_ACTION.deleteCard]: ({ id }) => store.deleteCard(id),
  [MESSAGE_ACTION.readSettings]: () => store.readSettings(),
  [MESSAGE_ACTION.writeSettings]: ({ patch }) => store.writeSettings(patch),
  [MESSAGE_ACTION.openSettings]: () => chrome.runtime.openOptionsPage(),
  [MESSAGE_ACTION.pageActive]: (_message, sender) => lightUp(sender?.tab?.id),
  [MESSAGE_ACTION.registerOrigin]: ({ origin }) => registerOrigin(chrome, origin),
  [MESSAGE_ACTION.unregisterOrigin]: ({ origin }) => unregisterOrigin(chrome, origin),
};

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const handler = HANDLERS[message?.action];
  if (!handler) return false;

  // 失败要带回给调用方，让界面能说出「存储失败」，而不是静默丢掉
  handler(message, sender)
    .then((result) => respond({ ok: true, result }))
    .catch((error) => respond({ ok: false, error: error.message }));

  // 返回 true 表示稍后异步 respond
  return true;
});
