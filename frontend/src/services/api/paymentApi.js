
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
