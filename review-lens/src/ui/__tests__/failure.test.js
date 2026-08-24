import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_KIND } from "../../core/gitlab.js";
import { createDrawer, HOST_TAG } from "../drawer.js";

const thread = {
  author: "cp.tang",
  body: "取值前要判 getSuccess()",
  path: "src/a/HotelInfoCollector.java",
  anchorLine: 19,
};

let drawer;

beforeEach(() => {
  document.body.replaceChildren();
  drawer = createDrawer({ styleText: "" });
});

afterEach(() => {
  drawer.close();
});

const shadow = () => document.body.querySelector(HOST_TAG).shadowRoot;
const buttonLabels = () => [...shadow().querySelectorAll("button")].map((node) => node.textContent);

function failWith(kind, handlers = {}) {
  drawer.render({ status: "failed", thread, error: { kind, status: 401 }, ...handlers });
}

describe("failure state", () => {
  it("always says what happened and offers a way on", () => {
    for (const kind of Object.values(ERROR_KIND)) {
      failWith(kind);

      const text = shadow().textContent;
      expect(text.length).toBeGreaterThan(20);
      expect(buttonLabels()).toContain("重试");
    }
  });

  it("gives each failure its own explanation", () => {
    const explanations = new Set();
    for (const kind of Object.values(ERROR_KIND)) {
      failWith(kind);
      explanations.add(shadow().querySelector(".failure strong").textContent);
    }

    expect(explanations.size).toBe(Object.values(ERROR_KIND).length);
  });

  it("offers the token route only when the session was rejected", () => {
    failWith(ERROR_KIND.unauthenticated);
    expect(buttonLabels()).toContain("配置访问令牌");

    failWith(ERROR_KIND.forbidden);
    expect(buttonLabels()).not.toContain("配置访问令牌");
  });

  it("shows the machine reason next to the human one", () => {
    failWith(ERROR_KIND.unauthenticated);

    expect(shadow().querySelector(".failure-code").textContent).toContain("401");
  });

  it("renders no code pane, so nothing looks like real code", () => {
    failWith(ERROR_KIND.server);

    expect(shadow().querySelector(".pane")).toBeNull();
    expect(shadow().querySelectorAll("[data-line]")).toHaveLength(0);
  });

  it("still explains an error it has no entry for", () => {
    drawer.render({ status: "failed", thread, error: { kind: "somethingNew", status: 0 } });

    expect(shadow().querySelector(".failure strong").textContent.length).toBeGreaterThan(0);
    expect(buttonLabels()).toContain("重试");
  });

  it("retries through the caller", () => {
    const onRetry = vi.fn();
    failWith(ERROR_KIND.network, { onRetry });

    [...shadow().querySelectorAll("button")].find((node) => node.textContent === "重试").click();

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("opens settings through the caller", () => {
    const onConfigureToken = vi.fn();
    failWith(ERROR_KIND.unauthenticated, { onConfigureToken });

    [...shadow().querySelectorAll("button")]
      .find((node) => node.textContent === "配置访问令牌")
      .click();

    expect(onConfigureToken).toHaveBeenCalledTimes(1);
  });
});
