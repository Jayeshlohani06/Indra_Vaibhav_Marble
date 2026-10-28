import { beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN_KEY = "indra-vaibhav-auth-token";

// The client reads the saved token when it loads, so each test loads a fresh
// copy after setting up storage.
async function loadClient() {
  vi.resetModules();
  return import("./httpClient");
}

function mockFetch(status, body) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body === undefined ? "" : JSON.stringify(body)),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("login token storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves the token so closing the phone app does not log staff out", async () => {
    const { setAuthToken } = await loadClient();
    setAuthToken("token-123");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("token-123");
  });

  it("removes the saved token on logout", async () => {
    const { setAuthToken } = await loadClient();
    setAuthToken("token-123");
    setAuthToken(null);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("sends the saved token after the app is reopened", async () => {
    localStorage.setItem(TOKEN_KEY, "saved-token");
    const fetchMock = mockFetch(200, { ok: true });
    const { default: httpClient } = await loadClient();

    await httpClient.get("/api/auth/me");

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/me$/);
    expect(options.headers.Authorization).toBe("Bearer saved-token");
  });

  it("sends no token when nobody is logged in", async () => {
    const fetchMock = mockFetch(200, []);
    const { default: httpClient } = await loadClient();

    await httpClient.get("/api/products");

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("forgets an expired token and tells the app to show the login page", async () => {
    localStorage.setItem(TOKEN_KEY, "expired-token");
    mockFetch(401, { message: "Session expired" });
    const { default: httpClient } = await loadClient();
    const onExpired = vi.fn();
    window.addEventListener("auth-expired", onExpired);

    await expect(httpClient.get("/api/products")).rejects.toThrow("Session expired");

    window.removeEventListener("auth-expired", onExpired);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("keeps the token when the server refuses for another reason", async () => {
    localStorage.setItem(TOKEN_KEY, "good-token");
    mockFetch(403, { message: "Not allowed" });
    const { default: httpClient } = await loadClient();

    await expect(httpClient.get("/api/users")).rejects.toThrow("Not allowed");

    expect(localStorage.getItem(TOKEN_KEY)).toBe("good-token");
  });
});

describe("readStored and writeStored", () => {
  it("round-trip a value and remove it with null", async () => {
    const { readStored, writeStored } = await loadClient();
    writeStored("some-key", "value");
    expect(readStored("some-key")).toBe("value");
    writeStored("some-key", null);
    expect(readStored("some-key")).toBeNull();
  });

  // Private browsing and some phones block storage; the app must still open.
  it("do not crash when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    const { readStored, writeStored, setAuthToken } = await loadClient();

    expect(readStored("any")).toBeNull();
    expect(() => writeStored("any", "x")).not.toThrow();
    expect(() => writeStored("any", null)).not.toThrow();
    expect(() => setAuthToken("token")).not.toThrow();
  });
});
