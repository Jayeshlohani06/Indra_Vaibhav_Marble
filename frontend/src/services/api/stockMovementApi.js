import httpClient from "../http/httpClient";

export function getAllStockMovements() {
  return httpClient.get("/api/stock-movements");
}

export function getStockMovementsByProduct(productId) {
  if (!productId) {
    throw new Error("Product ID is required");
  }

  return httpClient.get(
    `/api/stock-movements/product/${encodeURIComponent(productId)}`
  );
}