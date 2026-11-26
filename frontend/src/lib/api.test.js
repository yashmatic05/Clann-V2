/**
 * Admin-token interceptor tests — the public pages must never send the token.
 *
 * The shared axios instance in src/lib/api.js attaches `X-Admin-Token` to
 * `/admin/*` and to writes on `/events`, but reads of `/events` are public
 * endpoints: only the admin panel (and the admin login at
 * /admin-clann-secret) may carry the token on a GET, so that expired events
 * stay visible there while public pages get the normal date-filtered listing.
 *
 * A fake adapter is installed on the real instance, so the request actually
 * travels through the interceptor chain and the adapter sees the final
 * headers. `window.location.pathname` is swapped per case via spyOn, which
 * jsdom allows because it is configurable.
 */

const { api } = require("./api");

const TOKEN = "test-admin-token";

let originalPathname;
let originalAdapter;

/** Capture each outgoing request after the interceptors have run. */
const useCapturingAdapter = () => {
  const seen = [];
  api.defaults.adapter = (config) => {
    seen.push(config);
    return Promise.resolve({
      data: {},
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    });
  };
  return seen;
};

/** Pretend the tab is on `path`; every request below goes through `run`. */
const fromPath = async (path, run) => {
  const spy = jest
    .spyOn(window, "location", "get")
    .mockReturnValue({ ...window.location, pathname: path });
  try {
    return await run();
  } finally {
    spy.mockRestore();
  }
};

const headerOf = (config) => config.headers["X-Admin-Token"];

const send = async (method, url, path) => {
  const seen = useCapturingAdapter();
  await fromPath(path, () => api.request({ method, url }));
  return seen[0];
};

beforeEach(() => {
  localStorage.setItem("clann_admin_token", TOKEN);
  originalPathname = window.location.pathname;
  originalAdapter = api.defaults.adapter;
});

afterEach(() => {
  localStorage.clear();
  api.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
  expect(window.location.pathname).toBe(originalPathname);
});

describe("GET /events — the token is admin-page only", () => {
  test("is not attached on the home page", async () => {
    const config = await send("get", "/events", "/");
    expect(headerOf(config)).toBeUndefined();
  });

  test("is attached from /admin", async () => {
    const config = await send("get", "/events", "/admin");
    expect(headerOf(config)).toBe(TOKEN);
  });

  test("is attached from the admin login at /admin-clann-secret", async () => {
    const config = await send("get", "/events", "/admin-clann-secret");
    expect(headerOf(config)).toBe(TOKEN);
  });

  test("is not attached on an event detail page", async () => {
    const config = await send("get", "/events", "/event/evt_1");
    expect(headerOf(config)).toBeUndefined();
  });

  test("is not attached on /events or any other public page", async () => {
    const publicPaths = [
      "/events",
      "/search",
      "/saved",
      "/calendar",
      "/organizer",
      "/profile",
      "/complete-profile",
    ];
    for (const path of publicPaths) {
      // eslint-disable-next-line no-await-in-loop
      const config = await send("get", "/events", path);
      expect(headerOf(config)).toBeUndefined();
    }
  });
});

describe("writes to /events — the token is always attached", () => {
  test.each(["post", "put", "delete"])("%s carries it from a public page", async (method) => {
    for (const path of ["/", "/event/evt_1"]) {
      // eslint-disable-next-line no-await-in-loop
      const config = await send(method, "/events", path);
      expect(headerOf(config)).toBe(TOKEN);
    }
  });
});

describe("/admin/* — the token is always attached", () => {
  test.each(["get", "post", "put", "delete"])("%s carries it from a public page", async (method) => {
    const config = await send(method, "/admin/stats", "/");
    expect(headerOf(config)).toBe(TOKEN);
  });

  test("a GET on a nested admin route carries it from /admin", async () => {
    const config = await send("get", "/admin/events/export", "/admin");
    expect(headerOf(config)).toBe(TOKEN);
  });
});

describe("without a stored token", () => {
  test("no header is ever added", async () => {
    localStorage.removeItem("clann_admin_token");
    const cases = [
      ["get", "/events", "/admin"],
      ["get", "/events", "/"],
      ["post", "/events", "/"],
      ["delete", "/events", "/event/evt_1"],
      ["get", "/admin/stats", "/admin"],
      ["put", "/admin/events/evt_1", "/"],
    ];
    for (const [method, url, path] of cases) {
      // eslint-disable-next-line no-await-in-loop
      const config = await send(method, url, path);
      expect(headerOf(config)).toBeUndefined();
    }
  });
});
