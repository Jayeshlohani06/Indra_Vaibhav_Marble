
import httpClient from "../http/httpClient";

// ===============================
// Products
// ===============================

export async function getProducts() {
  return httpClient.get("/api/products");
}

export async function getProductById(id) {
  return httpClient.get(`/api/products/${id}`);
}

export async function createProduct(product) {
  return httpClient.post("/api/products", product);
}

export async function updateProduct(id, product) {
  return httpClient.put(`/api/products/${id}`, product);
}

export async function deactivateProduct(id) {
  return httpClient.delete(`/api/products/${id}`);
}

// ===============================
// Categories and measurement units
// ===============================

export async function getCategories() {
  return httpClient.get("/api/categories");
}

export async function getMeasurementUnits() {
  return httpClient.get("/api/units");
}

// ===============================
// Inventory tracking configuration
// ===============================

export async function getInventorySettings(productId) {
  return httpClient.get(`/api/inventory/settings/${productId}`);
}

export async function saveInventorySettings(productId, settings) {
  return httpClient.put(
    `/api/inventory/settings/${productId}`,
    settings
  );
}

// ===============================
// Stock movement history
// ===============================

export async function getStockMovements() {
  return httpClient.get("/api/stock-movements");
}

export async function getProductStockMovements(productId) {
  return httpClient.get(
    `/api/stock-movements/product/${productId}`
  );
}

export async function recordStockMovement(movement) {
  return httpClient.post("/api/stock-movements", movement);
}

