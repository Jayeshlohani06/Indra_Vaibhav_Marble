
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

export async function getSalesOrderPayments(orderId) {
  return httpClient.get(`/api/sales-orders/${orderId}/payments`);
}

export async function recordSalesOrderPayment(orderId, payment) {
  return httpClient.post(`/api/sales-orders/${orderId}/payments`, payment);
}

export async function getSalesOrderBalance(orderId) {
  return httpClient.get(`/api/sales-orders/${orderId}/payments/balance`);
}

export async function createSalesReturn(orderId, salesReturn) {
  return httpClient.post(`/api/sales-orders/${orderId}/returns`, salesReturn);
}

export async function cancelSalesOrder(orderId, cancellation) {
  return httpClient.post(`/api/sales-orders/${orderId}/cancel`, cancellation);
}

export async function changeSalesPaymentMethod(orderId, paymentId, paymentMethod, reason) {
  return httpClient.post(`/api/sales-orders/${orderId}/payments/${paymentId}/method`, { paymentMethod, reason });
}
