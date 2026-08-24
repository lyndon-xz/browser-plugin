import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ENTRY_CLASS, attachEntries } from "../entry.js";

/*
 * DOM 按内网实例实测结构还原（hoteldynamicinfo/buyoutservice!27）：
 * 讨论容器是 [data-discussion-id].discussion，折叠时容器内没有任何 note 元素，
 * 但 .discussion-actions（装着「显示主题」按钮）存在且可见。
 */
function discussionElement(discussionId, { collapsed = true } = {}) {
  const box = document.createElement("div");
  box.className = "discussion js-discussion-container";
  box.dataset.discussionId = discussionId;
  box.dataset.discussionResolved = "true";

  const actions = document.createElement("div");
  actions.className = "discussion-actions";
  const toggle = document.createElement("button");
  toggle.className = "discussion-toggle-button";
  toggle.textContent = "显示主题";
  actions.append(toggle);
  box.append(actions);

  if (!collapsed) {
    const note = document.createElement("li");
    note.className = "note note-wrapper";
    note.dataset.noteId = "999";
    box.append(note);
  }
  return box;
}

function pageWith(...discussionIds) {
  const list = document.createElement("div");
  list.className = "main-notes-list";
  list.append(...discussionIds.map((id) => discussionElement(id)));
  document.body.replaceChildren(list);
  return list;
}

let stop;

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  stop?.();
  stop = undefined;
});

const entries = () => [...document.querySelectorAll(`.${ENTRY_CLASS}`)];
const ownerOf = (entry) => entry.closest("[data-discussion-id]").dataset.discussionId;

const attach = (onOpen = () => {}, codeDiscussionIds) =>
  attachEntries({ root: document.body, codeDiscussionIds, onOpen });

describe("attachEntries", () => {
  it("mounts on collapsed threads, which hold no note element at all", () => {
    pageWith("d1", "d2");

    stop = attach();

    expect(entries()).toHaveLength(2);
    expect(document.querySelectorAll("[data-note-id]")).toHaveLength(0);
  });

  it("puts the entry next to GitLab's own thread toggle", () => {
    pageWith("d1");

    stop = attach();

    expect(entries()[0].parentElement.className).toContain("discussion-actions");
  });

  it("skips threads the API did not report as code discussions", () => {
    pageWith("d1", "d2", "d3");

    stop = attach(() => {}, new Set(["d1", "d3"]));

    expect(entries().map(ownerOf)).toEqual(["d1", "d3"]);
  });

  it("does not add a second entry when run again", () => {
    pageWith("d1", "d2");

    stop = attach();
    attachEntries({ root: document.body, onOpen: () => {} })();

    expect(entries()).toHaveLength(2);
  });

  it("picks up threads rendered after the page loaded", async () => {
    const list = pageWith("d1");
    stop = attach();

    list.append(discussionElement("d2"));
    await vi.waitFor(() => expect(entries()).toHaveLength(2));
  });

  it("hands the caller the discussion id, never page text", () => {
    pageWith("1d3bb93a605af4aff3c69957ae5db2c2b58a648e");
    const onOpen = vi.fn();
    stop = attach(onOpen);

    entries()[0].click();

    expect(onOpen).toHaveBeenCalledWith({ discussionId: "1d3bb93a605af4aff3c69957ae5db2c2b58a648e" });
  });

  it("falls back to the container when GitLab renders no action bar", () => {
    const box = discussionElement("d1");
    box.querySelector(".discussion-actions").remove();
    document.body.replaceChildren(box);

    stop = attach();

    expect(entries()).toHaveLength(1);
  });

  it("stops watching once torn down", async () => {
    const list = pageWith("d1");
    const detach = attach();

    detach();
    list.append(discussionElement("d2"));

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(entries()).toHaveLength(1);
  });
});
