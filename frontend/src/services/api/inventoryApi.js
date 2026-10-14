
import httpClient from "../http/httpClient";

export async function getProducts() {
  return httpClient.get("/api/products");
}

export async function getCategories() {
  return httpClient.get("/api/categories");
}

export async function getMeasurementUnits() {
  return httpClient.get("/api/units");
}

export async function createProduct(product) {
  return httpClient.post("/api/products", product);
}
