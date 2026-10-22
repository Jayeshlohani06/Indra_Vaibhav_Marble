import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createExpense,
  createExpenseCategory,
  getExpenseCategories,
  getExpenses,
  updateExpense,
  voidExpense,
} from "../../services/api/expenseApi";
import { getSuppliers } from "../../services/api/supplierApi";
import "./ExpensesPage.css";
import { usePermission } from "../../auth/PermissionsContext";

const today = () => new Date().toISOString().slice(0, 10);
const initialForm = () => ({
  expenseDate: today(), category: "", description: "", amount: "",
  paymentMethod: "CASH", supplierId: "", referenceNumber: "", notes: "",
});
const paymentMethods = [
  ["CASH", "Cash"], ["UPI", "UPI"], ["BANK_TRANSFER", "Bank transfer"],
  ["CHEQUE", "Cheque"], ["CARD", "Card"], ["OTHER", "Other"],
];
const currency = (value) => Number(value || 0).toLocaleString("en-IN", {
  style: "currency", currency: "INR",
});
const expenseErrorMessage = (error, action) =>
  error?.message === "An unexpected error occurred"
    ? `Unable to ${action}. Restart the backend so the latest expense migration is applied, then try again.`
    : error?.message || `Unable to ${action}.`;

function ExpensesPage() {
  const canManageExpenses = usePermission("EXPENSE_MANAGE");
  const [expenses, setExpenses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ search: "", startDate: "", endDate: "", category: "", paymentMethod: "", status: "ALL" });
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [details, setDetails] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("date");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const pageSize = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const expenseData = await getExpenses({
        startDate: filters.startDate,
        endDate: filters.endDate,
        category: filters.category,
        status: filters.status,
      });
      setExpenses(Array.isArray(expenseData) ? expenseData : []);

      const [supplierResult, categoryResult] = await Promise.allSettled([
        getSuppliers(),
        getExpenseCategories(),
      ]);

      if (supplierResult.status === "fulfilled") {
        const supplierData = supplierResult.value;
        setSuppliers(Array.isArray(supplierData) ? supplierData : supplierData?.data || []);
      } else {
        setSuppliers([]);
      }

      if (categoryResult.status === "fulfilled") {
        const categoryData = categoryResult.value;
        setCategories(Array.isArray(categoryData) ? categoryData : categoryData?.data || []);
      } else {
        const fallbackCategories = [...new Set(
          (Array.isArray(expenseData) ? expenseData : [])
            .map((expense) => expense.category)
            .filter(Boolean)
        )].map((name) => ({ id: name, name }));
        setCategories(fallbackCategories);
      }
      setError("");
    } catch (err) {
      setError(
        err.message === "An unexpected error occurred"
          ? "Unable to load expenses. Restart the backend once so the latest expense database migration can run."
          : err.message || "Unable to load expenses."
      );
    } finally {
      setLoading(false);
    }
  }, [filters.category, filters.endDate, filters.startDate, filters.status]);

  useEffect(() => { load(); }, [load]);

  const supplierName = useCallback(
    (id) => suppliers.find((supplier) => supplier.id === id)?.name || "—",
    [suppliers]
  );
  const visible = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return expenses
      .filter((expense) => !filters.paymentMethod || expense.paymentMethod === filters.paymentMethod)
      .filter((expense) => !term || [expense.category, expense.description, expense.referenceNumber, expense.notes, supplierName(expense.supplierId)].some((value) => String(value || "").toLowerCase().includes(term)))
      .sort((a, b) => sort === "amount"
        ? Number(b.amount) - Number(a.amount)
        : String(b.expenseDate).localeCompare(String(a.expenseDate)));
  }, [expenses, filters.paymentMethod, filters.search, sort, supplierName]);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const rows = visible.slice((page - 1) * pageSize, page * pageSize);
  const active = expenses.filter((expense) => expense.status !== "VOIDED");
  const total = active.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const average = active.length ? total / active.length : 0;
  const highest = active.reduce((max, expense) => Math.max(max, Number(expense.amount || 0)), 0);
  const topCategory = Object.entries(active.reduce((result, expense) => {
    result[expense.category] = (result[expense.category] || 0) + Number(expense.amount || 0);
    return result;
  }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  function updateFilter(name, value) {
    setFilters((previous) => ({ ...previous, [name]: value }));
    setPage(1);
  }

  function openCreate() {
    setEditingId(null); setForm(initialForm()); setShowForm(true); setError(""); setSuccess("");
  }

  function openEdit(expense) {
    setEditingId(expense.id);
    setForm({ expenseDate: expense.expenseDate || today(), category: expense.category || "", description: expense.description || "", amount: expense.amount || "", paymentMethod: expense.paymentMethod || "CASH", supplierId: expense.supplierId || "", referenceNumber: expense.referenceNumber || "", notes: expense.notes || "" });
    setDetails(null); setShowForm(true); setError("");
  }

  function changeForm(event) {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.category.trim() || !form.expenseDate || !Number.isFinite(amount) || amount <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(form.amount))) {
      setError("Enter a date, category, and a valid amount with at most two decimal places.");
      return;
    }
    setSaving(true); setError("");
    const payload = { ...form, category: form.category.trim(), description: form.description.trim() || null, amount: form.amount, supplierId: form.supplierId ? Number(form.supplierId) : null, referenceNumber: form.referenceNumber.trim() || null, notes: form.notes.trim() || null };
    try {
      if (editingId) await updateExpense(editingId, payload);
      else await createExpense(payload);
      setShowForm(false); setSuccess(editingId ? "Expense updated successfully." : "Expense saved successfully."); await load();
    } catch (err) { setError(err.message || "Unable to save expense."); } finally { setSaving(false); }
  }

  async function addCategory(event) {
    event.preventDefault();
    const categoryName = newCategory.trim();
    if (!categoryName) {
      setError("Enter a category name.");
      return;
    }
    try {
      const response = await createExpenseCategory({ name: categoryName, categoryType: "OPERATING" });
      const created = response?.data || response;
      const savedCategory = {
        ...(created || {}),
        name: created?.name || categoryName,
      };
      setCategories((previous) => [
        ...previous.filter((category) => category.name.toLowerCase() !== savedCategory.name.toLowerCase()),
        savedCategory,
      ].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((previous) => ({ ...previous, category: savedCategory.name }));
      setError("");
      setNewCategory(""); setShowCategoryForm(false);
    } catch (err) { setError(err.message || "Unable to add category."); }
  }

  async function handleVoid(expense) {
    const reason = window.prompt("Enter the reason for voiding this expense:");
    if (!reason?.trim()) return;
    try { await voidExpense(expense.id, reason); setDetails(null); setSuccess("Expense voided and retained in history."); await load(); }
    catch (err) { setError(expenseErrorMessage(err, "void expense")); }
  }

  function exportCsv() {
    const header = ["Date", "Category", "Description", "Supplier", "Payment method", "Amount", "Status", "Reference"];
    const lines = visible.map((expense) => [expense.expenseDate, expense.category, expense.description, supplierName(expense.supplierId), expense.paymentMethod, expense.amount, expense.status, expense.referenceNumber].map((value) => `"${String(value || "").replaceAll("\"", "\"\"")}"`).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = "expenses.csv"; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <main className="expenses-page">
      <div className="expenses-page__header"><div><p className="expenses-eyebrow">FINANCE MANAGEMENT</p><h1>Expenses</h1><p>Track, review, and control business spending.</p></div><div className="expenses-actions"><button type="button" onClick={exportCsv} disabled={!visible.length}>Export CSV</button>{canManageExpenses && <button type="button" className="expenses-primary-button" onClick={openCreate}>+ Add Expense</button>}</div></div>
      <div className="expenses-kpis"><div><span>Total active expenses</span><strong>{currency(total)}</strong><small>{active.length} records</small></div><div><span>Average expense</span><strong>{currency(average)}</strong><small>Per active record</small></div><div><span>Highest expense</span><strong>{currency(highest)}</strong><small>Largest active record</small></div><div><span>Top category</span><strong>{topCategory}</strong><small>By total value</small></div></div>
      {error && <p className="expenses-alert expenses-error" role="alert">{error}</p>}
      {success && <p className="expenses-alert expenses-success" role="status">{success}</p>}
      <section className="expenses-table-card">
        <div className="expenses-toolbar"><input type="search" placeholder="Search category, description, supplier..." value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} /><input type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} aria-label="Start date" /><input type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} aria-label="End date" /><select value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select><select value={filters.paymentMethod} onChange={(event) => updateFilter("paymentMethod", event.target.value)}><option value="">All payment methods</option>{paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="VOIDED">Voided</option></select><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="date">Newest first</option><option value="amount">Highest amount</option></select><button type="button" onClick={() => { setFilters({ search: "", startDate: "", endDate: "", category: "", paymentMethod: "", status: "ALL" }); setPage(1); }}>Clear</button></div>
        {loading ? <p className="expenses-empty">Loading expenses...</p> : !rows.length ? <p className="expenses-empty">No expenses match the current filters.</p> : <div className="expenses-table-wrapper"><table className="expenses-table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Supplier</th><th>Payment</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((expense) => <tr key={expense.id}><td>{expense.expenseDate}</td><td><strong>{expense.category}</strong>{expense.referenceNumber && <small>Ref: {expense.referenceNumber}</small>}</td><td>{expense.description || "—"}</td><td>{supplierName(expense.supplierId)}</td><td>{expense.paymentMethod}</td><td>{currency(expense.amount)}</td><td><span className={`expense-status ${expense.status === "VOIDED" ? "is-voided" : ""}`}>{expense.status}</span></td><td><div className="expense-row-actions"><button type="button" onClick={() => setDetails(expense)}>View</button>{canManageExpenses && expense.status !== "VOIDED" && <><button type="button" onClick={() => openEdit(expense)}>Edit</button><button type="button" className="is-danger" onClick={() => handleVoid(expense)}>Void</button></>}</div></td></tr>)}</tbody></table></div>}
        <div className="expenses-pagination"><span>Showing {visible.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, visible.length)} of {visible.length}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><strong>Page {page} of {pageCount}</strong><button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</button></div></div>
      </section>
      {showForm && <div className="expenses-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setShowForm(false)}><form noValidate className="expenses-modal" onSubmit={submit}><div className="expenses-modal-heading"><h2>{editingId ? "Edit expense" : "Record expense"}</h2><button type="button" onClick={() => setShowForm(false)}>Close</button></div><div className="expenses-form-grid"><label>Date *<input type="date" name="expenseDate" value={form.expenseDate} onChange={changeForm} required /></label><label>Category *<div className="expense-category-field"><select name="category" value={form.category} onChange={changeForm} required aria-invalid={!form.category.trim()}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select><button type="button" onClick={() => setShowCategoryForm(true)}>+</button></div></label><label>Amount (₹) *<input type="number" name="amount" min="0.01" step="0.01" value={form.amount} onChange={changeForm} required /></label><label>Payment method *<select name="paymentMethod" value={form.paymentMethod} onChange={changeForm}>{paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Supplier (optional)<select name="supplierId" value={form.supplierId} onChange={changeForm}><option value="">No supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label>Reference number<input name="referenceNumber" maxLength="100" value={form.referenceNumber} onChange={changeForm} placeholder="Receipt or transaction ID" /></label><label className="expenses-field-wide">Description<input name="description" maxLength="500" value={form.description} onChange={changeForm} /></label><label className="expenses-field-wide">Notes<textarea name="notes" maxLength="1000" rows="3" value={form.notes} onChange={changeForm} /></label></div><div className="expenses-form-actions"><button type="button" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="expenses-primary-button" disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Save expense"}</button></div></form></div>}
      {showCategoryForm && <div className="expenses-modal-backdrop nested" onMouseDown={(event) => event.target === event.currentTarget && setShowCategoryForm(false)}><form className="expenses-small-modal" onSubmit={addCategory}><h2>Add expense category</h2><input autoFocus value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="e.g. Office supplies" maxLength="100" /><div className="expenses-form-actions"><button type="button" onClick={() => setShowCategoryForm(false)}>Cancel</button><button className="expenses-primary-button">Add category</button></div></form></div>}
      {details && <div className="expenses-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDetails(null)}><section className="expenses-small-modal"><div className="expenses-modal-heading"><h2>Expense details</h2><button type="button" onClick={() => setDetails(null)}>Close</button></div><div className="expense-detail-grid"><p><span>Date</span><strong>{details.expenseDate}</strong></p><p><span>Category</span><strong>{details.category}</strong></p><p><span>Amount</span><strong>{currency(details.amount)}</strong></p><p><span>Payment</span><strong>{details.paymentMethod}</strong></p><p><span>Supplier</span><strong>{supplierName(details.supplierId)}</strong></p><p><span>Status</span><strong>{details.status}</strong></p><p><span>Reference</span><strong>{details.referenceNumber || "—"}</strong></p><p><span>Description</span><strong>{details.description || "—"}</strong></p></div>{details.notes && <p className="expense-notes"><b>Notes</b><br />{details.notes}</p>}<div className="expenses-form-actions">{details.status !== "VOIDED" && <><button type="button" onClick={() => openEdit(details)}>Edit</button><button type="button" className="is-danger" onClick={() => handleVoid(details)}>Void expense</button></>}</div></section></div>}
    </main>
  );
}

export default ExpensesPage;
