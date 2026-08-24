import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerOrigin } from "../register-origin.js";

/*
 * 用户在设置里加的站点：先要权限、再动态注册 content script。
 * 默认清单只匹配已知的两个站点（TD-9），这条路径是唯一的扩面方式，所以要测牢。
 */
let chromeApi;

beforeEach(() => {
  chromeApi = {
    permissions: { request: vi.fn(async () => true) },
    scripting: {
      registerContentScripts: vi.fn(async () => {}),
      unregisterContentScripts: vi.fn(async () => {}),
    },
  };
});

const register = (origin) => registerOrigin(chromeApi, origin);

describe("registerOrigin", () => {
  it("asks for exactly the origin the user typed, nothing wider", async () => {
    await register("https://gitlab.example.com");

    expect(chromeApi.permissions.request).toHaveBeenCalledWith({
      origins: ["https://gitlab.example.com/*"],
    });
  });

  it("registers the bootstrap script for that origin only", async () => {
    await register("https://gitlab.example.com");

    const [[scripts]] = chromeApi.scripting.registerContentScripts.mock.calls;
    expect(scripts[0]).toMatchObject({
      matches: ["https://gitlab.example.com/*"],
      js: ["content/bootstrap.js"],
    });
  });

  it("registers nothing when the user declines", async () => {
    chromeApi.permissions.request.mockResolvedValueOnce(false);

    await expect(register("https://gitlab.example.com")).resolves.toEqual({ granted: false });
    expect(chromeApi.scripting.registerContentScripts).not.toHaveBeenCalled();
  });

  it("refuses an origin that is not an origin", async () => {
    for (const bad of ["gitlab.example.com", "https://gitlab.example.com/group", ""]) {
      await expect(register(bad)).resolves.toEqual({ granted: false, reason: "bad-origin" });
    }
    expect(chromeApi.permissions.request).not.toHaveBeenCalled();
  });

  it("survives re-registering the same origin", async () => {
    chromeApi.scripting.registerContentScripts.mockRejectedValueOnce(
      new Error("Duplicate script ID"),
    );

    await expect(register("https://gitlab.example.com")).resolves.toEqual({ granted: true });
  });
});
