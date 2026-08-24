import { beforeEach, describe, expect, it } from "vitest";

import { isMergeRequestPage } from "../page.js";

function pageWith({ dataPage, lang = "zh-CN" } = {}) {
  document.documentElement.lang = lang;
  document.body.replaceChildren();
  if (dataPage === undefined) {
    delete document.body.dataset.page;
  } else {
    document.body.dataset.page = dataPage;
  }
  return document;
}

const at = (pathname) => ({ pathname });

describe("isMergeRequestPage", () => {
  beforeEach(() => {
    pageWith();
  });

  it("accepts the merge request discussion page by data-page", () => {
    const doc = pageWith({ dataPage: "projects:merge_requests:show" });

    expect(isMergeRequestPage(doc, at("/group/repo/-/merge_requests/2797"))).toBe(true);
  });

  it("rejects other GitLab pages by data-page", () => {
    const doc = pageWith({ dataPage: "projects:issues:show" });

    expect(isMergeRequestPage(doc, at("/group/repo/-/issues/3"))).toBe(false);
  });

  it("prefers data-page over the URL when the two disagree", () => {
    const doc = pageWith({ dataPage: "projects:issues:show" });

    expect(isMergeRequestPage(doc, at("/group/repo/-/merge_requests/2797"))).toBe(false);
  });

  it("falls back to the URL when data-page is absent", () => {
    const doc = pageWith();

    expect(isMergeRequestPage(doc, at("/group/repo/-/merge_requests/2797"))).toBe(true);
    expect(isMergeRequestPage(doc, at("/group/repo/-/merge_requests"))).toBe(false);
    expect(isMergeRequestPage(doc, at("/group/repo/-/issues/3"))).toBe(false);
  });

  it("judges the same regardless of interface language", () => {
    const zh = isMergeRequestPage(
      pageWith({ dataPage: "projects:merge_requests:show", lang: "zh-CN" }),
      at("/group/repo/-/merge_requests/2797"),
    );
    const en = isMergeRequestPage(
      pageWith({ dataPage: "projects:merge_requests:show", lang: "en" }),
      at("/group/repo/-/merge_requests/2797"),
    );

    expect(zh).toBe(en);
  });

  it("leaves the page untouched", () => {
    const doc = pageWith({ dataPage: "projects:merge_requests:show" });
    doc.body.append(doc.createElement("div"));
    const before = doc.body.innerHTML;

    isMergeRequestPage(doc, at("/group/repo/-/merge_requests/2797"));

    expect(doc.body.innerHTML).toBe(before);
  });
});
