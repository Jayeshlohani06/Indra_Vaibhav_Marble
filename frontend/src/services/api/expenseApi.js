
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

  if (filters.status) {
    query.set("status", filters.status);
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

export async function updateExpense(id, expense) {
  return httpClient.put(`/api/expenses/${id}`, expense);
}

export async function voidExpense(id, reason) {
  return httpClient.post(`/api/expenses/${id}/void`, { reason });
}

export async function getExpenseCategories() {
  return httpClient.get("/api/expense-categories");
}

export async function createExpenseCategory(category) {
  return httpClient.post("/api/expense-categories", category);
}

export async function getStaff() {
  return httpClient.get("/api/staff");
}

export async function createStaff(staff) {
  return httpClient.post("/api/staff", staff);
}

export async function updateStaff(id, staff) {
  return httpClient.put(`/api/staff/${id}`, staff);
}
