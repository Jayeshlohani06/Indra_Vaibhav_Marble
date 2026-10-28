
import httpClient from "../http/httpClient";

export async function getFinancialSummary(startDate, endDate) {
  const query = new URLSearchParams({
    startDate,
    endDate,
  });

  return httpClient.get(`/api/reports/financial-summary?${query.toString()}`);
}

export async function getSupplierOutstanding() {
  return httpClient.get("/api/reports/supplier-outstanding");
}

export async function getCustomerOutstanding() {
  return httpClient.get("/api/reports/customer-outstanding");
}

export async function getPaymentDateSummary() {
  return httpClient.get("/api/reports/payment-date-summary");
}


export async function getPaymentReminders(minDays = 30) {
  return httpClient.get(`/api/reports/payment-reminders?minDays=${encodeURIComponent(minDays)}`);
}

export async function getMonthlyProfit(from, to) {
  return httpClient.get(`/api/reports/monthly-profit?${new URLSearchParams({ from, to }).toString()}`);
}
