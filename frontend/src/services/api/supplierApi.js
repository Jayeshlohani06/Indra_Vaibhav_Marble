
import httpClient from "../http/httpClient";

export async function getSuppliers() {
  return httpClient.get("/api/suppliers");
}

export async function getSupplierById(id) {
  return httpClient.get(`/api/suppliers/${id}`);
}

export async function createSupplier(supplier) {
  return httpClient.post("/api/suppliers", supplier);
}

export async function updateSupplier(id, supplier) {
  return httpClient.put(`/api/suppliers/${id}`, supplier);
}

export async function deactivateSupplier(id) {
  return httpClient.delete(`/api/suppliers/${id}`);
}
