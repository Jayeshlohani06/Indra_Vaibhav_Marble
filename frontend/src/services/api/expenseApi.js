
import httpClient from "../http/httpClient";

export async function getExpenses(filters = {}) {
  const query = new URLSearchParams();

  if (filters.startDate) {
    query.set("startDate", filters.startDate);
  }

  if (filters.endDate) {
    query.set("endDate", filters.endDate);
  }

  if (filters.category) {
    query.set("category", filters.category);
  }

  const queryString = query.toString();
  const endpoint = queryString
    ? `/api/expenses?${queryString}`
    : "/api/expenses";

  return httpClient.get(endpoint);
}

export async function getExpenseById(id) {
  return httpClient.get(`/api/expenses/${id}`);
}

export async function createExpense(expense) {
  return httpClient.post("/api/expenses", expense);
}
