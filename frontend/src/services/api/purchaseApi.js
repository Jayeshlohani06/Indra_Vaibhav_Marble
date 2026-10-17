import httpClient from "../http/httpClient";
export async function getPurchases() {
  return httpClient.get("/api/purchases");
}
export async function getPurchaseById(id) {
  return httpClient.get(`/api/purchases/${id}`);
}
export async function createPurchase(purchase) {
  return httpClient.post("/api/purchases", purchase);
}
export async function receivePurchase(id) {
  return httpClient.post(`/api/purchases/${id}/receive`);
}
