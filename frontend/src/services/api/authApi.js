
import httpClient from "../http/httpClient";
import { setAuthToken } from "../http/httpClient";

export async function login(email, password) {
  const response = await httpClient.post("/api/auth/login", {
    email,
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
