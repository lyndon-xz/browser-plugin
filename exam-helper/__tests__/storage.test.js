import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StorageHelper } from "../utils/storage.js";

describe("StorageHelper 启用状态读写（chrome.storage.local）", () => {
  beforeEach(() => {
    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(),
          set: vi.fn(),
        },
      },
    };
  });

  afterEach(() => {
    delete globalThis.chrome;
    vi.restoreAllMocks();
  });

  it("未设置时 getEnabled() 返回默认值 true", async () => {
    chrome.storage.local.get.mockResolvedValue({});
    await expect(StorageHelper.getEnabled()).resolves.toBe(true);
    expect(chrome.storage.local.get).toHaveBeenCalledWith("enabled");
  });

  it("存储为 { enabled:false } 时 getEnabled() 返回 false", async () => {
    chrome.storage.local.get.mockResolvedValue({ enabled: false });
    await expect(StorageHelper.getEnabled()).resolves.toBe(false);
  });

  it("存储为 { enabled:true } 时 getEnabled() 返回 true", async () => {
    chrome.storage.local.get.mockResolvedValue({ enabled: true });
    await expect(StorageHelper.getEnabled()).resolves.toBe(true);
  });

  it("读取抛异常时回退默认值 true", async () => {
    chrome.storage.local.get.mockRejectedValue(new Error("boom"));
    await expect(StorageHelper.getEnabled()).resolves.toBe(true);
  });

  it("chrome 未定义时 getEnabled() 回退默认值 true", async () => {
    delete globalThis.chrome;
    await expect(StorageHelper.getEnabled()).resolves.toBe(true);
  });

  it("setEnabled(false) 调用 chrome.storage.local.set 并传入 { enabled:false }", async () => {
    chrome.storage.local.set.mockResolvedValue(undefined);
    await StorageHelper.setEnabled(false);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ enabled: false });
  });

  it("setEnabled(true) 传入 { enabled:true }", async () => {
    chrome.storage.local.set.mockResolvedValue(undefined);
    await StorageHelper.setEnabled(true);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ enabled: true });
  });
});
