/*
 * GitLab 只读客户端：先用宿主页登录态（同源 cookie），被拒才回退到用户配的访问令牌。
 * 只发 GET，不需要 CSRF token。
 */

/** 归成判别态而不是几个布尔：失败原因只有一个，界面据此选文案与出路 */
export const ERROR_KIND = {
  unauthenticated: "unauthenticated",
  forbidden: "forbidden",
  notFound: "notFound",
  server: "server",
  network: "network",
  // 说不清的那一类。判别态的兜底值必须是「说不清」，不能是某个具体原因
  unexpected: "unexpected",
};

/** GitLab API 失败时抛出的带 kind 与 status 的错误 */
export class GitLabRequestError extends Error {
  constructor(kind, status, message) {
    super(message);
    this.name = "GitLabRequestError";
    this.kind = kind;
    this.status = status;
  }
}

const KIND_BY_STATUS = {
  401: ERROR_KIND.unauthenticated,
  403: ERROR_KIND.forbidden,
  404: ERROR_KIND.notFound,
};

// 400、429 既不是登录失效也不是权限不足，兜底成 unauthenticated 会把人引向配令牌这条死路
const kindOf = (status) =>
  KIND_BY_STATUS[status] ??
  (status >= 500 ? ERROR_KIND.server : ERROR_KIND.unexpected);

const isAuthRejection = (status) =>
  kindOf(status) === ERROR_KIND.unauthenticated ||
  kindOf(status) === ERROR_KIND.forbidden;

/** 只读 GitLab 客户端：同源 cookie，必要时回退访问令牌 */
export function createGitLabClient(config) {
  const { origin, fetch, readToken } = config;

  const CACHE_TTL_MS = 5 * 60 * 1000;
  const cache = new Map();
  // 令牌回退一旦成功就记住，省掉之后每次都先撞一次 401
  let hasAcceptedToken = false;

  async function request(path, options) {
    const { isUsingToken } = options;

    let token = null;
    if (isUsingToken) {
      try {
        token = await readToken();
      } catch {
        // 读不到令牌（后台不可达、还没配）就等于没有令牌，不能让它变成另一个异常
        token = null;
      }
    }

    /*
     * 只返回 Response，不返回 null：调用方读 null 的 .ok 会抛裸 TypeError，error.kind 是
     * undefined，界面只能说「未知错误」，说不出重配令牌或重新登录这两条出路。
     */
    if (isUsingToken && !token) {
      throw new GitLabRequestError(
        ERROR_KIND.unauthenticated,
        0,
        "读不到访问令牌",
      );
    }

    let response;
    try {
      response = await fetch(`${origin}/api/v4${path}`, {
        credentials: "same-origin",
        headers: token ? { "PRIVATE-TOKEN": token } : {},
      });
    } catch (cause) {
      throw new GitLabRequestError(ERROR_KIND.network, 0, cause.message);
    }
    return response;
  }

  async function fetchOnce(path, read) {
    let response = await request(path, { isUsingToken: hasAcceptedToken });

    // 登录态被拒时才动用令牌；403 同样可能是会话身份不足，一并尝试
    if (!response.ok && isAuthRejection(response.status) && !hasAcceptedToken) {
      // 令牌读不到时 request 会抛 unauthenticated，那正是该报给用户的原因
      const retried = await request(path, { isUsingToken: true });
      if (retried.ok) {
        hasAcceptedToken = true;
      }
      response = retried;
    }

    if (!response.ok) {
      throw new GitLabRequestError(
        kindOf(response.status),
        response.status,
        `GitLab ${response.status}`,
      );
    }
    return read(response);
  }

  // 失败不进缓存，否则「重试」按钮点了也只是拿回同一个错误
  function cached(path, read) {
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return hit.promise;
    }
    if (hit) {
      cache.delete(path);
    }

    const pending = (async () => {
      try {
        return await fetchOnce(path, read);
      } catch (error) {
        cache.delete(path);
        throw error;
      }
    })();
    cache.set(path, { promise: pending, at: Date.now() });
    return pending;
  }

  function invalidate(prefix) {
    for (const key of cache.keys()) {
      if (
        key === prefix ||
        key.startsWith(`${prefix}/`) ||
        key.startsWith(`${prefix}?`)
      ) {
        cache.delete(key);
      }
    }
  }

  return {
    get: (path) => cached(path, (response) => response.json()),
    getText: (path) => cached(path, (response) => response.text()),
    invalidate,
  };
}
