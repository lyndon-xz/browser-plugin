import { describe, expect, it, vi } from "vitest";

import { createGitLabClient, ERROR_KIND } from "../gitlab.js";

const ORIGIN = "http://git.dev.sh.ctripcorp.com";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function textResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new Error("not json");
    },
    text: async () => body,
  };
}

function clientWith(fetchImpl, token = null) {
  return createGitLabClient({
    origin: ORIGIN,
    fetch: fetchImpl,
    readToken: async () => token,
  });
}

const lastCall = (fetchImpl) => fetchImpl.mock.calls.at(-1);

describe("createGitLabClient", () => {
  it("sends same-origin cookies and no token on the first attempt", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ iid: 2797 }));

    const data = await clientWith(fetchImpl, "glpat-xxx").get("/projects/a%2Fb/merge_requests/2797");

    expect(data).toEqual({ iid: 2797 });
    const [url, options] = lastCall(fetchImpl);
    expect(url).toBe(`${ORIGIN}/api/v4/projects/a%2Fb/merge_requests/2797`);
    expect(options.credentials).toBe("same-origin");
    expect(options.headers).not.toHaveProperty("PRIVATE-TOKEN");
  });

  it("reports an unauthenticated session and does not retry without a token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ message: "401" }, 401));

    await expect(clientWith(fetchImpl).get("/projects/a%2Fb")).rejects.toMatchObject({
      kind: ERROR_KIND.unauthenticated,
      status: 401,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries once with the token when the session is rejected", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "401" }, 401))
      .mockResolvedValueOnce(jsonResponse({ iid: 2797 }));

    const data = await clientWith(fetchImpl, "glpat-xxx").get("/projects/a%2Fb");

    expect(data).toEqual({ iid: 2797 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(lastCall(fetchImpl)[1].headers["PRIVATE-TOKEN"]).toBe("glpat-xxx");
  });

  it("keeps using the token once the fallback succeeded", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "401" }, 401))
      .mockResolvedValue(jsonResponse({ ok: true }));
    const client = clientWith(fetchImpl, "glpat-xxx");

    await client.get("/first");
    await client.get("/second");

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(lastCall(fetchImpl)[1].headers["PRIVATE-TOKEN"]).toBe("glpat-xxx");
  });

  it("classifies the failures a reader can act on", async () => {
    const cases = [
      [403, ERROR_KIND.forbidden],
      [404, ERROR_KIND.notFound],
      [500, ERROR_KIND.server],
    ];

    for (const [status, kind] of cases) {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ message: String(status) }, status));

      await expect(clientWith(fetchImpl).get("/projects/a%2Fb")).rejects.toMatchObject({
        kind,
        status,
      });
    }
  });

  it("classifies a dropped request as a network failure", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(clientWith(fetchImpl).get("/projects/a%2Fb")).rejects.toMatchObject({
      kind: ERROR_KIND.network,
    });
  });

  it("treats an unreadable token as no token, instead of crashing the caller", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ message: "401" }, 401));
    const client = createGitLabClient({
      origin: ORIGIN,
      fetch: fetchImpl,
      // 后台不可达时读设置会失败
      readToken: async () => {
        throw new Error("扩展后台没有响应");
      },
    });

    await expect(client.get("/projects/a%2Fb")).rejects.toMatchObject({
      kind: ERROR_KIND.unauthenticated,
    });
  });

  it("serves the same path from cache", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ iid: 2797 }));
    const client = clientWith(fetchImpl);

    await client.get("/projects/a%2Fb");
    await client.get("/projects/a%2Fb");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not cache failures, so retrying can succeed", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "500" }, 500))
      .mockResolvedValueOnce(jsonResponse({ iid: 2797 }));
    const client = clientWith(fetchImpl);

    await expect(client.get("/projects/a%2Fb")).rejects.toMatchObject({ status: 500 });

    await expect(client.get("/projects/a%2Fb")).resolves.toEqual({ iid: 2797 });
  });

  it("reads raw file contents as text", async () => {
    const source = "public class Foo {\n}\n";
    const fetchImpl = vi.fn().mockResolvedValue(textResponse(source));

    const text = await clientWith(fetchImpl).getText("/projects/a%2Fb/repository/files/x/raw?ref=abc");

    expect(text).toBe(source);
  });
});
