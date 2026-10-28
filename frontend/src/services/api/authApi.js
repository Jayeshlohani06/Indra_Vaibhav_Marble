
import httpClient from "../http/httpClient";
import { setAuthToken } from "../http/httpClient";

// The login box takes a mobile number or an email address.
export async function login(identifier, password) {
  const response = await httpClient.post("/api/auth/login", {
    identifier,
    password,
  });

  if (!response?.accessToken) {
    throw new Error("Login response did not contain an access token");
  }

  setAuthToken(response.accessToken);

  return response;
}

export function getCurrentUser() {
  return httpClient.get("/api/auth/me");
}

export function logout() {
  setAuthToken(null);
}
