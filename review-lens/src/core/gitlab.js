/*
 * GitLab 只读客户端。鉴权按 TD-2：先用宿主页登录态（同源 cookie），被拒才回退到用户配的
 * 访问令牌。只发 GET，所以不需要 CSRF token。
 */

// 归成判别态而不是几个布尔：失败原因只有一个，界面据此选文案与出路
export const ERROR_KIND = {
  unauthenticated: "unauthenticated",
  forbidden: "forbidden",
  notFound: "notFound",
  server: "server",
  network: "network",
};

const KIND_BY_STATUS = {
  401: ERROR_KIND.unauthenticated,
  403: ERROR_KIND.forbidden,
  404: ERROR_KIND.notFound,
};

class GitLabRequestError extends Error {
  constructor(kind, status, message) {
    super(message);
    this.name = "GitLabRequestError";
    this.kind = kind;
    this.status = status;
  }
}

const kindOf = (status) =>
  KIND_BY_STATUS[status] ?? (status >= 500 ? ERROR_KIND.server : ERROR_KIND.unauthenticated);

export function createGitLabClient({ origin, fetch, readToken }) {
  const cache = new Map();
  // 令牌回退一旦成功就记住，省掉之后每次都先撞一次 401
  let tokenAccepted = false;

  async function request(path, { withToken }) {
    // 读不到令牌（后台不可达、还没配）就等于没有令牌，不能让它变成另一个异常
    const token = withToken ? await readToken().catch(() => null) : null;
    if (withToken && !token) return null;

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
    let response = await request(path, { withToken: tokenAccepted });

    // 登录态被拒时才动用令牌；403 同样可能是会话身份不足，一并尝试
    if (!response.ok && (response.status === 401 || response.status === 403) && !tokenAccepted) {
      const retried = await request(path, { withToken: true });
      if (retried?.ok) {
        tokenAccepted = true;
        response = retried;
      } else if (retried) {
        response = retried;
      }
    }

    if (!response.ok) {
      throw new GitLabRequestError(kindOf(response.status), response.status, `GitLab ${response.status}`);
    }
    return read(response);
  }

  // 失败不进缓存，否则「重试」按钮点了也只是拿回同一个错误
  function cached(path, read) {
    if (cache.has(path)) return cache.get(path);

    const pending = fetchOnce(path, read).catch((error) => {
      cache.delete(path);
      throw error;
    });
    cache.set(path, pending);
    return pending;
  }

  return {
    get: (path) => cached(path, (response) => response.json()),
    getText: (path) => cached(path, (response) => response.text()),
    clearCache: () => cache.clear(),
  };
}
