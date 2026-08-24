import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ENTRY_CLASS, attachEntries } from "../entry.js";
import { isMergeRequestPage } from "../../core/page.js";

/*
 * 中英文界面下行为必须一致。做法是选择器与判定都只认结构性属性、不认文案——
 * 所以这里的断言里刻意不出现任何界面文案字符串，只有两份只在文案上不同的 fixture。
 */
function discussionElement(discussionId, toggleLabel) {
  const box = document.createElement("div");
  box.className = "discussion js-discussion-container";
  box.dataset.discussionId = discussionId;

  const actions = document.createElement("div");
  actions.className = "discussion-actions";
  const toggle = document.createElement("button");
  toggle.className = "discussion-toggle-button";
  toggle.dataset.testid = "thread-toggle";
  toggle.textContent = toggleLabel;
  actions.append(toggle);

  box.append(actions);
  return box;
}

function pageIn(language) {
  const labels = { zh: "显示主题", en: "Show thread" };
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.body.replaceChildren();
  document.body.dataset.page = "projects:merge_requests:show";

  const list = document.createElement("div");
  list.className = "main-notes-list";
  list.append(
    discussionElement("d1", labels[language]),
    discussionElement("d2", labels[language]),
  );
  document.body.append(list);
  return list;
}

let stop;

afterEach(() => {
  stop?.();
  stop = undefined;
});

const entries = () => [...document.querySelectorAll(`.${ENTRY_CLASS}`)];

const mountIn = (language) => {
  pageIn(language);
  stop = attachEntries({ root: document.body, onOpen: () => {} });
  return {
    mounted: entries().length,
    parents: entries().map((entry) => entry.parentElement.className),
    isMergeRequest: isMergeRequestPage(document, { pathname: "/g/r/-/merge_requests/27" }),
  };
};

describe("interface language", () => {
  it("mounts the same entries whatever the interface language", () => {
    const zh = mountIn("zh");
    stop();
    const en = mountIn("en");

    expect(zh.mounted).toBe(2);
    expect(en.mounted).toBe(zh.mounted);
    expect(en.parents).toEqual(zh.parents);
  });

  it("judges the page the same whatever the interface language", () => {
    const zh = mountIn("zh");
    stop();
    const en = mountIn("en");

    expect(zh.isMergeRequest).toBe(true);
    expect(en.isMergeRequest).toBe(zh.isMergeRequest);
  });

  it("does not depend on the toggle's copy at all", () => {
    pageIn("zh");
    // 文案清空也照样挂得上，说明选择器认的是结构不是文字
    for (const toggle of document.querySelectorAll(".discussion-toggle-button")) {
      toggle.textContent = "";
    }
    stop = attachEntries({ root: document.body, onOpen: () => {} });

    expect(entries()).toHaveLength(2);
  });
});
