
import httpClient from "../http/httpClient";

export async function getSuppliers(params = {}) {
  const query = params.status ? `?status=${encodeURIComponent(params.status)}` : "";
  return httpClient.get(`/api/suppliers${query}`);
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

export async function reactivateSupplier(id) {
  return httpClient.post(`/api/suppliers/${id}/reactivate`);
}
