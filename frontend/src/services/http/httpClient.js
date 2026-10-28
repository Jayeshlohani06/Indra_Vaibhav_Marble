
// The localhost fallback is for development only; production builds must set
// VITE_API_BASE_URL (vite.config.js fails the build otherwise).
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:8081" : "")
).replace(/\/+$/, "");
// Long enough for the server to wake from a cold start.
const REQUEST_TIMEOUT_MS = 90000;

// Kept in localStorage so closing the installed phone app does not log staff
// out; the token itself still expires on the server (8 hours by default).
const AUTH_TOKEN_KEY = "indra-vaibhav-auth-token";
let authToken = readStored(AUTH_TOKEN_KEY);

export function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key, value) {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Without storage the user simply logs in again next time.
  }
}

export function setAuthToken(token) {
  authToken = token || null;
  writeStored(AUTH_TOKEN_KEY, authToken);
}

async function request(endpoint, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(
        "The server took too long to respond. It may be starting up. " +
          "If you were saving something, refresh and check whether it was saved before trying again.",
        { cause: err }
      );
    }
    throw new Error(
      "Unable to reach the server. Check your internet connection and try again.",
      { cause: err }
    );
  } finally {
    window.clearTimeout(timeout);
  }

  const responseText = await response.text();
  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      // Proxy error pages (e.g. 502) are HTML; never show them as a message.
      const isHtml = /^\s*</.test(responseText);
      data = isHtml ? null : { message: responseText };
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      setAuthToken(null);
      window.dispatchEvent(new Event("auth-expired"));
    }
    throw new Error(
      data?.message ||
        data?.error ||
        `API request failed (${response.status})`
    );
  }

  return data;
}

// Several parts of a page often ask for the same list at the same moment.
// Identical GETs that are still in flight share one request; each caller gets
// its own copy so one part of the page cannot change another part's data.
const inFlightGets = new Map();

function getOnce(endpoint) {
  const key = `${authToken || ""} ${endpoint}`;
  let pending = inFlightGets.get(key);

  if (!pending) {
    pending = request(endpoint).finally(() => inFlightGets.delete(key));
    inFlightGets.set(key, pending);
  }

  return pending.then((data) => (data === null ? null : structuredClone(data)));
}

const httpClient = {
  get: (endpoint) => getOnce(endpoint),

  post: (endpoint, body) =>
    request(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  put: (endpoint, body) =>
    request(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  delete: (endpoint) =>
    request(endpoint, {
      method: "DELETE",
    }),
};

export default httpClient;
