import httpClient from "../http/httpClient";

function withQuery(endpoint, params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  const text = query.toString();
  return text ? `${endpoint}?${text}` : endpoint;
}

export function getCashToday() {
  return httpClient.get("/api/cash/today");
}

export function openCashDay(openingBalance, note) {
  return httpClient.post("/api/cash/sessions/open", { openingBalance, note });
}

export function closeCashDay(sessionId, closing) {
  return httpClient.post(`/api/cash/sessions/${sessionId}/close`, closing);
}

export function reopenCashDay(sessionId, reason) {
  return httpClient.post(`/api/cash/sessions/${sessionId}/reopen`, { reason });
}

export function getCashDay(sessionId) {
  return httpClient.get(`/api/cash/sessions/${sessionId}`);
}

export function getCashDays({ from, to, withDifference } = {}) {
  return httpClient.get(withQuery("/api/cash/sessions", { from, to, withDifference }));
}

export function updateCashSettings(approvalThreshold) {
  return httpClient.put("/api/cash/settings", { approvalThreshold });
}

export function getCashMovements({ from, to } = {}) {
  return httpClient.get(withQuery("/api/cash/movements", { from, to }));
}

export function recordCashMovement(movement) {
  return httpClient.post("/api/cash/movements", movement);
}

export function voidCashMovement(id, reason) {
  return httpClient.post(`/api/cash/movements/${id}/void`, { reason });
}

export function getCashbook({ from, to, paymentMethod, kind } = {}) {
  return httpClient.get(withQuery("/api/cash/reports/cashbook", { from, to, paymentMethod, kind }));
}

export function getExpenseCategoryReport({ from, to } = {}) {
  return httpClient.get(withQuery("/api/cash/reports/expenses", { from, to }));
}

export function getStaffPaymentReport({ from, to } = {}) {
  return httpClient.get(withQuery("/api/cash/reports/staff-payments", { from, to }));
}
