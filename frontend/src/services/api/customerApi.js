
import httpClient from "../http/httpClient";

export async function getCustomers(params = {}) {
  const query = new URLSearchParams();

  if (params.name?.trim()) {
    query.set("name", params.name.trim());
  }

  if (params.phone?.trim()) {
    query.set("phone", params.phone.trim());
  }

  const queryString = query.toString();
  const endpoint = queryString
    ? `/api/customers?${queryString}`
    : "/api/customers";

  return httpClient.get(endpoint);
}

export async function getCustomerById(id) {
  return httpClient.get(`/api/customers/${id}`);
}

export async function createCustomer(customer) {
  return httpClient.post("/api/customers", customer);
}

export async function updateCustomer(id, customer) {
  return httpClient.put(`/api/customers/${id}`, customer);
}

export async function deactivateCustomer(id) {
  return httpClient.delete(`/api/customers/${id}`);
}
