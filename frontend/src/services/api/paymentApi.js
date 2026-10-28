
import httpClient from "../http/httpClient";

export async function getPurchasePayments(purchaseId) {
  return httpClient.get(`/api/purchases/${purchaseId}/payments`);
}

export async function recordPurchasePayment(purchaseId, payment) {
  return httpClient.post(
    `/api/purchases/${purchaseId}/payments`,
    payment
  );
}

export async function getPurchaseBalance(purchaseId) {
  return httpClient.get(
    `/api/purchases/${purchaseId}/payments/balance`
  );
}

export async function changePurchasePaymentMethod(purchaseId, paymentId, paymentMethod, reason) {
  return httpClient.post(`/api/purchases/${purchaseId}/payments/${paymentId}/method`, { paymentMethod, reason });
}
