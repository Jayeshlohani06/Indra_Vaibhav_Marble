
import httpClient from "../http/httpClient";

export async function getHealth() {
  return httpClient.get("/api/health");
}
