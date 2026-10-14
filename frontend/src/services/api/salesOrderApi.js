
import httpClient from "../http/httpClient";

export async function getSalesOrders() {
  return httpClient.get("/api/sales-orders");
}

export async function getSalesOrderById(id) {
  return httpClient.get(`/api/sales-orders/${id}`);
}

export async function createSalesOrder(order) {
  return httpClient.post("/api/sales-orders", order);
}
