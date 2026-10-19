
import { useEffect, useState } from "react";

import {
  createExpense,
  getExpenses,
} from "../../services/api/expenseApi";
import { getSuppliers } from "../../services/api/supplierApi";

import "./ExpensesPage.css";

const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const INITIAL_FORM = {
  expenseDate: getTodayDate(),
  category: "",
  description: "",
  amount: "",
  paymentMethod: "CASH",
  supplierId: "",
  referenceNumber: "",
  notes: "",
};

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
];

function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadExpenses() {
    try {
      setLoading(true);
      setError("");

      const response = await getExpenses();

      const records = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : [];

      setExpenses(records);
    } catch (err) {
      setError(err.message || "Unable to load expenses.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadExpenses();

    getSuppliers()
      .then((response) => {
        const records = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];

        setSuppliers(records);
      })
      .catch(() => {
        // Supplier selection is optional.
      });
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const amount = Number(form.amount);

    if (!form.expenseDate) {
      setError("Please select an expense date.");
      return;
    }

    if (!form.category.trim()) {
      setError("Please enter an expense category.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(form.amount)) {
      setError("Amount can have at most two decimal places.");
      return;
    }

    const payload = {
      expenseDate: form.expenseDate,
      category: form.category.trim(),
      description: form.description.trim() || null,
      amount: form.amount,
      paymentMethod: form.paymentMethod,
      supplierId: form.supplierId
        ? Number(form.supplierId)
        : null,
      referenceNumber: form.referenceNumber.trim() || null,
      notes: form.notes.trim() || null,
    };

    try {
      setSaving(true);

      await createExpense(payload);

      setForm({
        ...INITIAL_FORM,
        expenseDate: getTodayDate(),
      });

      setShowForm(false);
      setSuccess("Expense saved successfully.");

      await loadExpenses();
    } catch (err) {
      setError(err.message || "Unable to save expense.");
    } finally {
      setSaving(false);
    }
  }

  const totalExpenses = expenses.reduce(
    (total, expense) => total + Number(expense.amount || 0),
    0
  );

  const formatCurrency = (amount) =>
    Number(amount || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
    });

  return (
    <main className="expenses-page">
      <div className="expenses-page__header">
        <div>
          <h1>Expenses</h1>
          <p>Track and manage your business expenses.</p>
        </div>

        <div className="expenses-actions">
          <button
            type="button"
            onClick={loadExpenses}
            disabled={loading || saving}
          >
            Refresh
          </button>

          <button
            type="button"
            className="expenses-primary-button"
            onClick={() => {
              setError("");
              setSuccess("");
              setShowForm((visible) => !visible);
            }}
          >
            {showForm ? "Cancel" : "+ Add Expense"}
          </button>
        </div>
      </div>

      <section className="expenses-summary">
        <span>Total recorded expenses</span>
        <strong>{formatCurrency(totalExpenses)}</strong>
        <small>{expenses.length} recorded expense(s)</small>
      </section>

      {error && (
        <p className="expenses-error" role="alert">
          {error}
        </p>
      )}

      {success && (
        <p className="expenses-success" role="status">
          {success}
        </p>
      )}

      {showForm && (
        <section className="expenses-form-card">
          <h2>Record a new expense</h2>

          <form onSubmit={handleSubmit}>
            <div className="expenses-form-grid">
              <label>
                Expense date *
                <input
                  type="date"
                  name="expenseDate"
                  value={form.expenseDate}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Category *
                <input
                  type="text"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  placeholder="e.g. Transport, Electricity"
                  maxLength={100}
                  required
                />
              </label>

              <label className="expenses-field-wide">
                Description (optional)
                <input
                  type="text"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Add a description if needed"
                  maxLength={500}
                />
              </label>

              <label>
                Amount (₹) *
                <input
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </label>

              <label>
                Payment method *
                <select
                  name="paymentMethod"
                  value={form.paymentMethod}
                  onChange={handleChange}
                  required
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option
                      key={method.value}
                      value={method.value}
                    >
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Supplier (optional)
                <select
                  name="supplierId"
                  value={form.supplierId}
                  onChange={handleChange}
                >
                  <option value="">No supplier</option>

                  {suppliers.map((supplier) => (
                    <option
                      key={supplier.id}
                      value={supplier.id}
                    >
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Reference number (optional)
                <input
                  type="text"
                  name="referenceNumber"
                  value={form.referenceNumber}
                  onChange={handleChange}
                  maxLength={100}
                  placeholder="Receipt or transaction ID"
                />
              </label>

              <label className="expenses-field-wide">
                Notes (optional)
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  maxLength={1000}
                  rows={3}
                  placeholder="Additional details"
                />
              </label>
            </div>

            <div className="expenses-form-actions">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="expenses-primary-button"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Expense"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="expenses-history">
        <h2>Expense history</h2>

        {loading && <p>Loading expenses...</p>}

        {!loading && expenses.length === 0 && (
          <p>No expenses recorded yet. Select Add Expense to begin.</p>
        )}

        {!loading && expenses.length > 0 && (
          <div className="expenses-table-wrapper">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Payment Method</th>
                  <th>Amount</th>
                </tr>
              </thead>

              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{expense.expenseDate}</td>
                    <td>{expense.category}</td>
                    <td>{expense.description || "—"}</td>
                    <td>{expense.paymentMethod}</td>
                    <td>{formatCurrency(expense.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default ExpensesPage;
