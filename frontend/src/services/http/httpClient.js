
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8081"
).replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 30000;

const AUTH_TOKEN_KEY = "indra-vaibhav-auth-token";
let authToken = sessionStorage.getItem(AUTH_TOKEN_KEY);

export function setAuthToken(token) {
  authToken = token || null;
  if (authToken) {
    sessionStorage.setItem(AUTH_TOKEN_KEY, authToken);
  } else {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  }
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
  } finally {
    window.clearTimeout(timeout);
  }

  const responseText = await response.text();
  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { message: responseText };
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

const httpClient = {
  get: (endpoint) => request(endpoint),

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
